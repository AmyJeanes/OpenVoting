// Response.json() is untyped, so callers name the API response shape they expect
export function readJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
