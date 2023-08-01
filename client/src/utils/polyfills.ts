function polyfillFindLastIndex() {
  if (!Array.prototype.findLastIndex) {
    Array.prototype.findLastIndex = function (callback, thisArg) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (callback.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    };
  }
}

function polyfillArrayFlat() {
  if (!Array.prototype.flat) {
    // eslint-disable-next-line space-before-function-paren
    Array.prototype.flat = function <A, D extends number = 1>(
      depth: D | undefined,
    ) {
      if (depth === undefined) {
        // @ts-ignore
        depth = 1;
      }

      const flatten = function (arr: any[], depth: number): FlatArray<A, D>[] {
        // If depth is 0, return the array as-is
        if (depth < 1) {
          return arr.slice();
        }

        return arr.reduce(function (acc: any[], val: any) {
          return acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val);
        }, []);
      };

      return flatten(this, depth as number);
    };
  }
}

const enablePolyfills = () => {
  polyfillFindLastIndex();
  polyfillArrayFlat();
};

export default enablePolyfills;
