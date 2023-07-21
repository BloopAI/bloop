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

const enablePolyfills = () => {
  polyfillFindLastIndex();
};

export default enablePolyfills;
