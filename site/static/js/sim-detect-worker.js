// Détection automatique de la surface (lot 3b), dans un worker pour ne pas figer la page.
// Modèle SlimSAM (Segment Anything allégé), hébergé avec le site : rien ne part vers un tiers,
// la photo ne quitte pas l'appareil du visiteur.
//
// Messages reçus :
//   {type: 'embed', id, rgba, W, H}            analyse la photo (une fois par photo)
//   {type: 'decode', id, points, labels}       masque pour les points touchés (1 = surface, 0 = à retirer)
// Messages envoyés : {type: 'progress', loaded, total}, {type: 'embedded', id},
//   {type: 'mask', id, mask (Uint8Array 0/255), score}, {type: 'error', message}

const MODEL = 'Xenova/slimsam-77-uniform';
let lib;
const cache = new Map();

async function load() {
  if (lib) return lib;
  lib = (async () => {
    const T = await import('../vendor/transformers/transformers.min.js');
    T.env.allowRemoteModels = false;
    T.env.allowLocalModels = true;
    T.env.localModelPath = new URL('../models/', import.meta.url).href;
    T.env.backends.onnx.wasm.wasmPaths = new URL('../vendor/transformers/', import.meta.url).href;
    // Sans isolation cross-origin (cas de GitHub Pages), pas de calcul multi-fils
    if (!self.crossOriginIsolated) T.env.backends.onnx.wasm.numThreads = 1;
    const files = {};
    const progress_callback = (p) => {
      if (p.status !== 'progress' || !p.total) return;
      files[p.file] = [p.loaded, p.total];
      const v = Object.values(files);
      postMessage({ type: 'progress', loaded: v.reduce((a, x) => a + x[0], 0), total: v.reduce((a, x) => a + x[1], 0) });
    };
    const [model, processor] = await Promise.all([
      T.SamModel.from_pretrained(MODEL, { dtype: 'q8', progress_callback }),
      T.AutoProcessor.from_pretrained(MODEL, { progress_callback }),
    ]);
    return { T, model, processor };
  })();
  try { return await lib; } catch (e) { lib = null; throw e; }
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    const { T, model, processor } = await load();
    if (m.type === 'embed') {
      postMessage({ type: 'progress', phase: 'analyse' });
      const image = new T.RawImage(new Uint8ClampedArray(m.rgba), m.W, m.H, 4).rgb();
      const inputs = await processor(image);
      const emb = await model.get_image_embeddings(inputs);
      cache.clear(); // une photo analysée à la fois suffit (le visiteur en a 2 au plus)
      cache.set(m.id, { emb, original_sizes: inputs.original_sizes, reshaped: inputs.reshaped_input_sizes, W: m.W, H: m.H });
      postMessage({ type: 'embedded', id: m.id, req: m.req });
    } else if (m.type === 'decode') {
      const c = cache.get(m.id);
      if (!c) throw new Error('photo non analysée');
      const input_points = processor.reshape_input_points([[m.points]], c.original_sizes, c.reshaped);
      const input_labels = processor.feature_extractor.add_input_labels([[m.labels]], input_points);
      const out = await model({ ...c.emb, input_points, input_labels });
      const masks = await processor.post_process_masks(out.pred_masks, c.original_sizes, c.reshaped);
      const scores = out.iou_scores.data;
      let best = 0;
      for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
      const n = c.W * c.H;
      const src = masks[0].data;
      const mask = new Uint8Array(n);
      for (let i = 0, o = best * n; i < n; i++) mask[i] = src[o + i] ? 255 : 0;
      postMessage({ type: 'mask', id: m.id, req: m.req, mask, score: scores[best] }, [mask.buffer]);
    }
  } catch (err) {
    postMessage({ type: 'error', id: m.id, req: m.req, message: String(err?.message || err) });
  }
};
