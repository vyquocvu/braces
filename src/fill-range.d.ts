declare module "fill-range" {
  interface FillRangeOptions {
    step?: number | string;
    strictRanges?: boolean;
    stringify?: boolean;
    toRegex?: boolean;
    wrap?: boolean;
    capture?: boolean;
    strictZeros?: boolean;
    relaxZeros?: boolean;
    transform?: (value: number, index: number) => string;
    [key: string]: unknown;
  }

  type FillRange = (
    start: number | string,
    end?: number | string,
    step?: number | string,
    options?: FillRangeOptions,
  ) => string[] | string;

  const fillRange: FillRange;
  export default fillRange;
}
