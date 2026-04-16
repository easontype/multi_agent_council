// Module-level relay for passing a File from home → analyze page within the same SPA session.
let _file: File | null = null;

export function setPendingUpload(file: File | null) {
  _file = file;
}

export function takePendingUpload(): File | null {
  const f = _file;
  _file = null;
  return f;
}
