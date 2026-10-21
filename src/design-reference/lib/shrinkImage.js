// Browser only: turns a picked screenshot into a smaller data URL (longest side ≤ 1600 px, WebP or JPEG),
// so proof and report uploads stay well under the server's 1.5 MB per image.
export async function shrinkImage(file, maxSide = 1600) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Pick a screenshot (PNG, JPG or WebP).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That file is over 25 MB. Try a smaller screenshot.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That screenshot couldn’t be opened. Try a PNG or JPG.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/webp', 0.82);
    if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.85);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
