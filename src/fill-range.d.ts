declare module "fill-range" {
  type FillRange = (
    start: number | string,
    end?: number | string,
    step?: number | string,
    options?: any,
  ) => string[] | string;

  const fillRange: FillRange;
  export default fillRange;
}
