(function () {
  const Q = document.createElement("link").relList;
  if (Q && Q.supports && Q.supports("modulepreload")) return;
  for (const R of document.querySelectorAll('link[rel="modulepreload"]')) h(R);
  new MutationObserver((R) => {
    for (const B of R)
      if (B.type === "childList")
        for (const U of B.addedNodes)
          U.tagName === "LINK" && U.rel === "modulepreload" && h(U);
  }).observe(document, { childList: !0, subtree: !0 });
  function x(R) {
    const B = {};
    return (
      R.integrity && (B.integrity = R.integrity),
      R.referrerPolicy && (B.referrerPolicy = R.referrerPolicy),
      R.crossOrigin === "use-credentials"
        ? (B.credentials = "include")
        : R.crossOrigin === "anonymous"
          ? (B.credentials = "omit")
          : (B.credentials = "same-origin"),
      B
    );
  }
  function h(R) {
    if (R.ep) return;
    R.ep = !0;
    const B = x(R);
    fetch(R.href, B);
  }
})();
function ly(f) {
  return f && f.__esModule && Object.prototype.hasOwnProperty.call(f, "default")
    ? f.default
    : f;
}
var Gf = { exports: {} },
  hn = {};
var Hr;
function ty() {
  if (Hr) return hn;
  Hr = 1;
  var f = Symbol.for("react.transitional.element"),
    Q = Symbol.for("react.fragment");
  function x(h, R, B) {
    var U = null;
    if (
      (B !== void 0 && (U = "" + B),
      R.key !== void 0 && (U = "" + R.key),
      "key" in R)
    ) {
      B = {};
      for (var Z in R) Z !== "key" && (B[Z] = R[Z]);
    } else B = R;
    return (
      (R = B.ref),
      { $$typeof: f, type: h, key: U, ref: R !== void 0 ? R : null, props: B }
    );
  }
  return ((hn.Fragment = Q), (hn.jsx = x), (hn.jsxs = x), hn);
}
var Br;
function ey() {
  return (Br || ((Br = 1), (Gf.exports = ty())), Gf.exports);
}
var S = ey(),
  Qf = { exports: {} },
  I = {};
var Nr;
function ay() {
  if (Nr) return I;
  Nr = 1;
  var f = Symbol.for("react.transitional.element"),
    Q = Symbol.for("react.portal"),
    x = Symbol.for("react.fragment"),
    h = Symbol.for("react.strict_mode"),
    R = Symbol.for("react.profiler"),
    B = Symbol.for("react.consumer"),
    U = Symbol.for("react.context"),
    Z = Symbol.for("react.forward_ref"),
    O = Symbol.for("react.suspense"),
    p = Symbol.for("react.memo"),
    q = Symbol.for("react.lazy"),
    j = Symbol.for("react.activity"),
    Y = Symbol.iterator;
  function pl(r) {
    return r === null || typeof r != "object"
      ? null
      : ((r = (Y && r[Y]) || r["@@iterator"]),
        typeof r == "function" ? r : null);
  }
  var V = {
      isMounted: function () {
        return !1;
      },
      enqueueForceUpdate: function () {},
      enqueueReplaceState: function () {},
      enqueueSetState: function () {},
    },
    fl = Object.assign,
    H = {};
  function Ol(r, A, C) {
    ((this.props = r),
      (this.context = A),
      (this.refs = H),
      (this.updater = C || V));
  }
  ((Ol.prototype.isReactComponent = {}),
    (Ol.prototype.setState = function (r, A) {
      if (typeof r != "object" && typeof r != "function" && r != null)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables.",
        );
      this.updater.enqueueSetState(this, r, A, "setState");
    }),
    (Ol.prototype.forceUpdate = function (r) {
      this.updater.enqueueForceUpdate(this, r, "forceUpdate");
    }));
  function Zl() {}
  Zl.prototype = Ol.prototype;
  function Cl(r, A, C) {
    ((this.props = r),
      (this.context = A),
      (this.refs = H),
      (this.updater = C || V));
  }
  var Hl = (Cl.prototype = new Zl());
  ((Hl.constructor = Cl), fl(Hl, Ol.prototype), (Hl.isPureReactComponent = !0));
  var Vl = Array.isArray;
  function ul() {}
  var G = { H: null, A: null, T: null, S: null },
    W = Object.prototype.hasOwnProperty;
  function ol(r, A, C) {
    var N = C.ref;
    return {
      $$typeof: f,
      type: r,
      key: A,
      ref: N !== void 0 ? N : null,
      props: C,
    };
  }
  function it(r, A) {
    return ol(r.type, A, r.props);
  }
  function Pl(r) {
    return typeof r == "object" && r !== null && r.$$typeof === f;
  }
  function Tl(r) {
    var A = { "=": "=0", ":": "=2" };
    return (
      "$" +
      r.replace(/[=:]/g, function (C) {
        return A[C];
      })
    );
  }
  var at = /\/+/g;
  function el(r, A) {
    return typeof r == "object" && r !== null && r.key != null
      ? Tl("" + r.key)
      : A.toString(36);
  }
  function Dl(r) {
    switch (r.status) {
      case "fulfilled":
        return r.value;
      case "rejected":
        throw r.reason;
      default:
        switch (
          (typeof r.status == "string"
            ? r.then(ul, ul)
            : ((r.status = "pending"),
              r.then(
                function (A) {
                  r.status === "pending" &&
                    ((r.status = "fulfilled"), (r.value = A));
                },
                function (A) {
                  r.status === "pending" &&
                    ((r.status = "rejected"), (r.reason = A));
                },
              )),
          r.status)
        ) {
          case "fulfilled":
            return r.value;
          case "rejected":
            throw r.reason;
        }
    }
    throw r;
  }
  function T(r, A, C, N, F) {
    var ll = typeof r;
    (ll === "undefined" || ll === "boolean") && (r = null);
    var yl = !1;
    if (r === null) yl = !0;
    else
      switch (ll) {
        case "bigint":
        case "string":
        case "number":
          yl = !0;
          break;
        case "object":
          switch (r.$$typeof) {
            case f:
            case Q:
              yl = !0;
              break;
            case q:
              return ((yl = r._init), T(yl(r._payload), A, C, N, F));
          }
      }
    if (yl)
      return (
        (F = F(r)),
        (yl = N === "" ? "." + el(r, 0) : N),
        Vl(F)
          ? ((C = ""),
            yl != null && (C = yl.replace(at, "$&/") + "/"),
            T(F, A, C, "", function (ee) {
              return ee;
            }))
          : F != null &&
            (Pl(F) &&
              (F = it(
                F,
                C +
                  (F.key == null || (r && r.key === F.key)
                    ? ""
                    : ("" + F.key).replace(at, "$&/") + "/") +
                  yl,
              )),
            A.push(F)),
        1
      );
    yl = 0;
    var kl = N === "" ? "." : N + ":";
    if (Vl(r))
      for (var Rl = 0; Rl < r.length; Rl++)
        ((N = r[Rl]), (ll = kl + el(N, Rl)), (yl += T(N, A, C, ll, F)));
    else if (((Rl = pl(r)), typeof Rl == "function"))
      for (r = Rl.call(r), Rl = 0; !(N = r.next()).done; )
        ((N = N.value), (ll = kl + el(N, Rl++)), (yl += T(N, A, C, ll, F)));
    else if (ll === "object") {
      if (typeof r.then == "function") return T(Dl(r), A, C, N, F);
      throw (
        (A = String(r)),
        Error(
          "Objects are not valid as a React child (found: " +
            (A === "[object Object]"
              ? "object with keys {" + Object.keys(r).join(", ") + "}"
              : A) +
            "). If you meant to render a collection of children, use an array instead.",
        )
      );
    }
    return yl;
  }
  function D(r, A, C) {
    if (r == null) return r;
    var N = [],
      F = 0;
    return (
      T(r, N, "", "", function (ll) {
        return A.call(C, ll, F++);
      }),
      N
    );
  }
  function K(r) {
    if (r._status === -1) {
      var A = r._result;
      ((A = A()),
        A.then(
          function (C) {
            (r._status === 0 || r._status === -1) &&
              ((r._status = 1), (r._result = C));
          },
          function (C) {
            (r._status === 0 || r._status === -1) &&
              ((r._status = 2), (r._result = C));
          },
        ),
        r._status === -1 && ((r._status = 0), (r._result = A)));
    }
    if (r._status === 1) return r._result.default;
    throw r._result;
  }
  var bl =
      typeof reportError == "function"
        ? reportError
        : function (r) {
            if (
              typeof window == "object" &&
              typeof window.ErrorEvent == "function"
            ) {
              var A = new window.ErrorEvent("error", {
                bubbles: !0,
                cancelable: !0,
                message:
                  typeof r == "object" &&
                  r !== null &&
                  typeof r.message == "string"
                    ? String(r.message)
                    : String(r),
                error: r,
              });
              if (!window.dispatchEvent(A)) return;
            } else if (
              typeof process == "object" &&
              typeof process.emit == "function"
            ) {
              process.emit("uncaughtException", r);
              return;
            }
            console.error(r);
          },
    zl = {
      map: D,
      forEach: function (r, A, C) {
        D(
          r,
          function () {
            A.apply(this, arguments);
          },
          C,
        );
      },
      count: function (r) {
        var A = 0;
        return (
          D(r, function () {
            A++;
          }),
          A
        );
      },
      toArray: function (r) {
        return (
          D(r, function (A) {
            return A;
          }) || []
        );
      },
      only: function (r) {
        if (!Pl(r))
          throw Error(
            "React.Children.only expected to receive a single React element child.",
          );
        return r;
      },
    };
  return (
    (I.Activity = j),
    (I.Children = zl),
    (I.Component = Ol),
    (I.Fragment = x),
    (I.Profiler = R),
    (I.PureComponent = Cl),
    (I.StrictMode = h),
    (I.Suspense = O),
    (I.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = G),
    (I.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function (r) {
        return G.H.useMemoCache(r);
      },
    }),
    (I.cache = function (r) {
      return function () {
        return r.apply(null, arguments);
      };
    }),
    (I.cacheSignal = function () {
      return null;
    }),
    (I.cloneElement = function (r, A, C) {
      if (r == null)
        throw Error(
          "The argument must be a React element, but you passed " + r + ".",
        );
      var N = fl({}, r.props),
        F = r.key;
      if (A != null)
        for (ll in (A.key !== void 0 && (F = "" + A.key), A))
          !W.call(A, ll) ||
            ll === "key" ||
            ll === "__self" ||
            ll === "__source" ||
            (ll === "ref" && A.ref === void 0) ||
            (N[ll] = A[ll]);
      var ll = arguments.length - 2;
      if (ll === 1) N.children = C;
      else if (1 < ll) {
        for (var yl = Array(ll), kl = 0; kl < ll; kl++)
          yl[kl] = arguments[kl + 2];
        N.children = yl;
      }
      return ol(r.type, F, N);
    }),
    (I.createContext = function (r) {
      return (
        (r = {
          $$typeof: U,
          _currentValue: r,
          _currentValue2: r,
          _threadCount: 0,
          Provider: null,
          Consumer: null,
        }),
        (r.Provider = r),
        (r.Consumer = { $$typeof: B, _context: r }),
        r
      );
    }),
    (I.createElement = function (r, A, C) {
      var N,
        F = {},
        ll = null;
      if (A != null)
        for (N in (A.key !== void 0 && (ll = "" + A.key), A))
          W.call(A, N) &&
            N !== "key" &&
            N !== "__self" &&
            N !== "__source" &&
            (F[N] = A[N]);
      var yl = arguments.length - 2;
      if (yl === 1) F.children = C;
      else if (1 < yl) {
        for (var kl = Array(yl), Rl = 0; Rl < yl; Rl++)
          kl[Rl] = arguments[Rl + 2];
        F.children = kl;
      }
      if (r && r.defaultProps)
        for (N in ((yl = r.defaultProps), yl))
          F[N] === void 0 && (F[N] = yl[N]);
      return ol(r, ll, F);
    }),
    (I.createRef = function () {
      return { current: null };
    }),
    (I.forwardRef = function (r) {
      return { $$typeof: Z, render: r };
    }),
    (I.isValidElement = Pl),
    (I.lazy = function (r) {
      return { $$typeof: q, _payload: { _status: -1, _result: r }, _init: K };
    }),
    (I.memo = function (r, A) {
      return { $$typeof: p, type: r, compare: A === void 0 ? null : A };
    }),
    (I.startTransition = function (r) {
      var A = G.T,
        C = {};
      G.T = C;
      try {
        var N = r(),
          F = G.S;
        (F !== null && F(C, N),
          typeof N == "object" &&
            N !== null &&
            typeof N.then == "function" &&
            N.then(ul, bl));
      } catch (ll) {
        bl(ll);
      } finally {
        (A !== null && C.types !== null && (A.types = C.types), (G.T = A));
      }
    }),
    (I.unstable_useCacheRefresh = function () {
      return G.H.useCacheRefresh();
    }),
    (I.use = function (r) {
      return G.H.use(r);
    }),
    (I.useActionState = function (r, A, C) {
      return G.H.useActionState(r, A, C);
    }),
    (I.useCallback = function (r, A) {
      return G.H.useCallback(r, A);
    }),
    (I.useContext = function (r) {
      return G.H.useContext(r);
    }),
    (I.useDebugValue = function () {}),
    (I.useDeferredValue = function (r, A) {
      return G.H.useDeferredValue(r, A);
    }),
    (I.useEffect = function (r, A) {
      return G.H.useEffect(r, A);
    }),
    (I.useEffectEvent = function (r) {
      return G.H.useEffectEvent(r);
    }),
    (I.useId = function () {
      return G.H.useId();
    }),
    (I.useImperativeHandle = function (r, A, C) {
      return G.H.useImperativeHandle(r, A, C);
    }),
    (I.useInsertionEffect = function (r, A) {
      return G.H.useInsertionEffect(r, A);
    }),
    (I.useLayoutEffect = function (r, A) {
      return G.H.useLayoutEffect(r, A);
    }),
    (I.useMemo = function (r, A) {
      return G.H.useMemo(r, A);
    }),
    (I.useOptimistic = function (r, A) {
      return G.H.useOptimistic(r, A);
    }),
    (I.useReducer = function (r, A, C) {
      return G.H.useReducer(r, A, C);
    }),
    (I.useRef = function (r) {
      return G.H.useRef(r);
    }),
    (I.useState = function (r) {
      return G.H.useState(r);
    }),
    (I.useSyncExternalStore = function (r, A, C) {
      return G.H.useSyncExternalStore(r, A, C);
    }),
    (I.useTransition = function () {
      return G.H.useTransition();
    }),
    (I.version = "19.2.4"),
    I
  );
}
var Yr;
function Kf() {
  return (Yr || ((Yr = 1), (Qf.exports = ay())), Qf.exports);
}
var k = Kf(),
  Lf = { exports: {} },
  yn = {},
  Zf = { exports: {} },
  Vf = {};
var qr;
function uy() {
  return (
    qr ||
      ((qr = 1),
      (function (f) {
        function Q(T, D) {
          var K = T.length;
          T.push(D);
          l: for (; 0 < K; ) {
            var bl = (K - 1) >>> 1,
              zl = T[bl];
            if (0 < R(zl, D)) ((T[bl] = D), (T[K] = zl), (K = bl));
            else break l;
          }
        }
        function x(T) {
          return T.length === 0 ? null : T[0];
        }
        function h(T) {
          if (T.length === 0) return null;
          var D = T[0],
            K = T.pop();
          if (K !== D) {
            T[0] = K;
            l: for (var bl = 0, zl = T.length, r = zl >>> 1; bl < r; ) {
              var A = 2 * (bl + 1) - 1,
                C = T[A],
                N = A + 1,
                F = T[N];
              if (0 > R(C, K))
                N < zl && 0 > R(F, C)
                  ? ((T[bl] = F), (T[N] = K), (bl = N))
                  : ((T[bl] = C), (T[A] = K), (bl = A));
              else if (N < zl && 0 > R(F, K))
                ((T[bl] = F), (T[N] = K), (bl = N));
              else break l;
            }
          }
          return D;
        }
        function R(T, D) {
          var K = T.sortIndex - D.sortIndex;
          return K !== 0 ? K : T.id - D.id;
        }
        if (
          ((f.unstable_now = void 0),
          typeof performance == "object" &&
            typeof performance.now == "function")
        ) {
          var B = performance;
          f.unstable_now = function () {
            return B.now();
          };
        } else {
          var U = Date,
            Z = U.now();
          f.unstable_now = function () {
            return U.now() - Z;
          };
        }
        var O = [],
          p = [],
          q = 1,
          j = null,
          Y = 3,
          pl = !1,
          V = !1,
          fl = !1,
          H = !1,
          Ol = typeof setTimeout == "function" ? setTimeout : null,
          Zl = typeof clearTimeout == "function" ? clearTimeout : null,
          Cl = typeof setImmediate < "u" ? setImmediate : null;
        function Hl(T) {
          for (var D = x(p); D !== null; ) {
            if (D.callback === null) h(p);
            else if (D.startTime <= T)
              (h(p), (D.sortIndex = D.expirationTime), Q(O, D));
            else break;
            D = x(p);
          }
        }
        function Vl(T) {
          if (((fl = !1), Hl(T), !V))
            if (x(O) !== null) ((V = !0), ul || ((ul = !0), Tl()));
            else {
              var D = x(p);
              D !== null && Dl(Vl, D.startTime - T);
            }
        }
        var ul = !1,
          G = -1,
          W = 5,
          ol = -1;
        function it() {
          return H ? !0 : !(f.unstable_now() - ol < W);
        }
        function Pl() {
          if (((H = !1), ul)) {
            var T = f.unstable_now();
            ol = T;
            var D = !0;
            try {
              l: {
                ((V = !1), fl && ((fl = !1), Zl(G), (G = -1)), (pl = !0));
                var K = Y;
                try {
                  t: {
                    for (
                      Hl(T), j = x(O);
                      j !== null && !(j.expirationTime > T && it());
                    ) {
                      var bl = j.callback;
                      if (typeof bl == "function") {
                        ((j.callback = null), (Y = j.priorityLevel));
                        var zl = bl(j.expirationTime <= T);
                        if (((T = f.unstable_now()), typeof zl == "function")) {
                          ((j.callback = zl), Hl(T), (D = !0));
                          break t;
                        }
                        (j === x(O) && h(O), Hl(T));
                      } else h(O);
                      j = x(O);
                    }
                    if (j !== null) D = !0;
                    else {
                      var r = x(p);
                      (r !== null && Dl(Vl, r.startTime - T), (D = !1));
                    }
                  }
                  break l;
                } finally {
                  ((j = null), (Y = K), (pl = !1));
                }
                D = void 0;
              }
            } finally {
              D ? Tl() : (ul = !1);
            }
          }
        }
        var Tl;
        if (typeof Cl == "function")
          Tl = function () {
            Cl(Pl);
          };
        else if (typeof MessageChannel < "u") {
          var at = new MessageChannel(),
            el = at.port2;
          ((at.port1.onmessage = Pl),
            (Tl = function () {
              el.postMessage(null);
            }));
        } else
          Tl = function () {
            Ol(Pl, 0);
          };
        function Dl(T, D) {
          G = Ol(function () {
            T(f.unstable_now());
          }, D);
        }
        ((f.unstable_IdlePriority = 5),
          (f.unstable_ImmediatePriority = 1),
          (f.unstable_LowPriority = 4),
          (f.unstable_NormalPriority = 3),
          (f.unstable_Profiling = null),
          (f.unstable_UserBlockingPriority = 2),
          (f.unstable_cancelCallback = function (T) {
            T.callback = null;
          }),
          (f.unstable_forceFrameRate = function (T) {
            0 > T || 125 < T
              ? console.error(
                  "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported",
                )
              : (W = 0 < T ? Math.floor(1e3 / T) : 5);
          }),
          (f.unstable_getCurrentPriorityLevel = function () {
            return Y;
          }),
          (f.unstable_next = function (T) {
            switch (Y) {
              case 1:
              case 2:
              case 3:
                var D = 3;
                break;
              default:
                D = Y;
            }
            var K = Y;
            Y = D;
            try {
              return T();
            } finally {
              Y = K;
            }
          }),
          (f.unstable_requestPaint = function () {
            H = !0;
          }),
          (f.unstable_runWithPriority = function (T, D) {
            switch (T) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
                break;
              default:
                T = 3;
            }
            var K = Y;
            Y = T;
            try {
              return D();
            } finally {
              Y = K;
            }
          }),
          (f.unstable_scheduleCallback = function (T, D, K) {
            var bl = f.unstable_now();
            switch (
              (typeof K == "object" && K !== null
                ? ((K = K.delay),
                  (K = typeof K == "number" && 0 < K ? bl + K : bl))
                : (K = bl),
              T)
            ) {
              case 1:
                var zl = -1;
                break;
              case 2:
                zl = 250;
                break;
              case 5:
                zl = 1073741823;
                break;
              case 4:
                zl = 1e4;
                break;
              default:
                zl = 5e3;
            }
            return (
              (zl = K + zl),
              (T = {
                id: q++,
                callback: D,
                priorityLevel: T,
                startTime: K,
                expirationTime: zl,
                sortIndex: -1,
              }),
              K > bl
                ? ((T.sortIndex = K),
                  Q(p, T),
                  x(O) === null &&
                    T === x(p) &&
                    (fl ? (Zl(G), (G = -1)) : (fl = !0), Dl(Vl, K - bl)))
                : ((T.sortIndex = zl),
                  Q(O, T),
                  V || pl || ((V = !0), ul || ((ul = !0), Tl()))),
              T
            );
          }),
          (f.unstable_shouldYield = it),
          (f.unstable_wrapCallback = function (T) {
            var D = Y;
            return function () {
              var K = Y;
              Y = D;
              try {
                return T.apply(this, arguments);
              } finally {
                Y = K;
              }
            };
          }));
      })(Vf)),
    Vf
  );
}
var Xr;
function ny() {
  return (Xr || ((Xr = 1), (Zf.exports = uy())), Zf.exports);
}
var Jf = { exports: {} },
  yt = {};
var Gr;
function iy() {
  if (Gr) return yt;
  Gr = 1;
  var f = Kf();
  function Q(O) {
    var p = "https://react.dev/errors/" + O;
    if (1 < arguments.length) {
      p += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var q = 2; q < arguments.length; q++)
        p += "&args[]=" + encodeURIComponent(arguments[q]);
    }
    return (
      "Minified React error #" +
      O +
      "; visit " +
      p +
      " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    );
  }
  function x() {}
  var h = {
      d: {
        f: x,
        r: function () {
          throw Error(Q(522));
        },
        D: x,
        C: x,
        L: x,
        m: x,
        X: x,
        S: x,
        M: x,
      },
      p: 0,
      findDOMNode: null,
    },
    R = Symbol.for("react.portal");
  function B(O, p, q) {
    var j =
      3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: R,
      key: j == null ? null : "" + j,
      children: O,
      containerInfo: p,
      implementation: q,
    };
  }
  var U = f.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function Z(O, p) {
    if (O === "font") return "";
    if (typeof p == "string") return p === "use-credentials" ? p : "";
  }
  return (
    (yt.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = h),
    (yt.createPortal = function (O, p) {
      var q =
        2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!p || (p.nodeType !== 1 && p.nodeType !== 9 && p.nodeType !== 11))
        throw Error(Q(299));
      return B(O, p, null, q);
    }),
    (yt.flushSync = function (O) {
      var p = U.T,
        q = h.p;
      try {
        if (((U.T = null), (h.p = 2), O)) return O();
      } finally {
        ((U.T = p), (h.p = q), h.d.f());
      }
    }),
    (yt.preconnect = function (O, p) {
      typeof O == "string" &&
        (p
          ? ((p = p.crossOrigin),
            (p =
              typeof p == "string"
                ? p === "use-credentials"
                  ? p
                  : ""
                : void 0))
          : (p = null),
        h.d.C(O, p));
    }),
    (yt.prefetchDNS = function (O) {
      typeof O == "string" && h.d.D(O);
    }),
    (yt.preinit = function (O, p) {
      if (typeof O == "string" && p && typeof p.as == "string") {
        var q = p.as,
          j = Z(q, p.crossOrigin),
          Y = typeof p.integrity == "string" ? p.integrity : void 0,
          pl = typeof p.fetchPriority == "string" ? p.fetchPriority : void 0;
        q === "style"
          ? h.d.S(O, typeof p.precedence == "string" ? p.precedence : void 0, {
              crossOrigin: j,
              integrity: Y,
              fetchPriority: pl,
            })
          : q === "script" &&
            h.d.X(O, {
              crossOrigin: j,
              integrity: Y,
              fetchPriority: pl,
              nonce: typeof p.nonce == "string" ? p.nonce : void 0,
            });
      }
    }),
    (yt.preinitModule = function (O, p) {
      if (typeof O == "string")
        if (typeof p == "object" && p !== null) {
          if (p.as == null || p.as === "script") {
            var q = Z(p.as, p.crossOrigin);
            h.d.M(O, {
              crossOrigin: q,
              integrity: typeof p.integrity == "string" ? p.integrity : void 0,
              nonce: typeof p.nonce == "string" ? p.nonce : void 0,
            });
          }
        } else p == null && h.d.M(O);
    }),
    (yt.preload = function (O, p) {
      if (
        typeof O == "string" &&
        typeof p == "object" &&
        p !== null &&
        typeof p.as == "string"
      ) {
        var q = p.as,
          j = Z(q, p.crossOrigin);
        h.d.L(O, q, {
          crossOrigin: j,
          integrity: typeof p.integrity == "string" ? p.integrity : void 0,
          nonce: typeof p.nonce == "string" ? p.nonce : void 0,
          type: typeof p.type == "string" ? p.type : void 0,
          fetchPriority:
            typeof p.fetchPriority == "string" ? p.fetchPriority : void 0,
          referrerPolicy:
            typeof p.referrerPolicy == "string" ? p.referrerPolicy : void 0,
          imageSrcSet:
            typeof p.imageSrcSet == "string" ? p.imageSrcSet : void 0,
          imageSizes: typeof p.imageSizes == "string" ? p.imageSizes : void 0,
          media: typeof p.media == "string" ? p.media : void 0,
        });
      }
    }),
    (yt.preloadModule = function (O, p) {
      if (typeof O == "string")
        if (p) {
          var q = Z(p.as, p.crossOrigin);
          h.d.m(O, {
            as: typeof p.as == "string" && p.as !== "script" ? p.as : void 0,
            crossOrigin: q,
            integrity: typeof p.integrity == "string" ? p.integrity : void 0,
          });
        } else h.d.m(O);
    }),
    (yt.requestFormReset = function (O) {
      h.d.r(O);
    }),
    (yt.unstable_batchedUpdates = function (O, p) {
      return O(p);
    }),
    (yt.useFormState = function (O, p, q) {
      return U.H.useFormState(O, p, q);
    }),
    (yt.useFormStatus = function () {
      return U.H.useHostTransitionStatus();
    }),
    (yt.version = "19.2.4"),
    yt
  );
}
var Qr;
function cy() {
  if (Qr) return Jf.exports;
  Qr = 1;
  function f() {
    if (
      !(
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" ||
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"
      )
    )
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(f);
      } catch (Q) {
        console.error(Q);
      }
  }
  return (f(), (Jf.exports = iy()), Jf.exports);
}
var Lr;
function fy() {
  if (Lr) return yn;
  Lr = 1;
  var f = ny(),
    Q = Kf(),
    x = cy();
  function h(l) {
    var t = "https://react.dev/errors/" + l;
    if (1 < arguments.length) {
      t += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var e = 2; e < arguments.length; e++)
        t += "&args[]=" + encodeURIComponent(arguments[e]);
    }
    return (
      "Minified React error #" +
      l +
      "; visit " +
      t +
      " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    );
  }
  function R(l) {
    return !(!l || (l.nodeType !== 1 && l.nodeType !== 9 && l.nodeType !== 11));
  }
  function B(l) {
    var t = l,
      e = l;
    if (l.alternate) for (; t.return; ) t = t.return;
    else {
      l = t;
      do ((t = l), (t.flags & 4098) !== 0 && (e = t.return), (l = t.return));
      while (l);
    }
    return t.tag === 3 ? e : null;
  }
  function U(l) {
    if (l.tag === 13) {
      var t = l.memoizedState;
      if (
        (t === null && ((l = l.alternate), l !== null && (t = l.memoizedState)),
        t !== null)
      )
        return t.dehydrated;
    }
    return null;
  }
  function Z(l) {
    if (l.tag === 31) {
      var t = l.memoizedState;
      if (
        (t === null && ((l = l.alternate), l !== null && (t = l.memoizedState)),
        t !== null)
      )
        return t.dehydrated;
    }
    return null;
  }
  function O(l) {
    if (B(l) !== l) throw Error(h(188));
  }
  function p(l) {
    var t = l.alternate;
    if (!t) {
      if (((t = B(l)), t === null)) throw Error(h(188));
      return t !== l ? null : l;
    }
    for (var e = l, a = t; ; ) {
      var u = e.return;
      if (u === null) break;
      var n = u.alternate;
      if (n === null) {
        if (((a = u.return), a !== null)) {
          e = a;
          continue;
        }
        break;
      }
      if (u.child === n.child) {
        for (n = u.child; n; ) {
          if (n === e) return (O(u), l);
          if (n === a) return (O(u), t);
          n = n.sibling;
        }
        throw Error(h(188));
      }
      if (e.return !== a.return) ((e = u), (a = n));
      else {
        for (var i = !1, c = u.child; c; ) {
          if (c === e) {
            ((i = !0), (e = u), (a = n));
            break;
          }
          if (c === a) {
            ((i = !0), (a = u), (e = n));
            break;
          }
          c = c.sibling;
        }
        if (!i) {
          for (c = n.child; c; ) {
            if (c === e) {
              ((i = !0), (e = n), (a = u));
              break;
            }
            if (c === a) {
              ((i = !0), (a = n), (e = u));
              break;
            }
            c = c.sibling;
          }
          if (!i) throw Error(h(189));
        }
      }
      if (e.alternate !== a) throw Error(h(190));
    }
    if (e.tag !== 3) throw Error(h(188));
    return e.stateNode.current === e ? l : t;
  }
  function q(l) {
    var t = l.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return l;
    for (l = l.child; l !== null; ) {
      if (((t = q(l)), t !== null)) return t;
      l = l.sibling;
    }
    return null;
  }
  var j = Object.assign,
    Y = Symbol.for("react.element"),
    pl = Symbol.for("react.transitional.element"),
    V = Symbol.for("react.portal"),
    fl = Symbol.for("react.fragment"),
    H = Symbol.for("react.strict_mode"),
    Ol = Symbol.for("react.profiler"),
    Zl = Symbol.for("react.consumer"),
    Cl = Symbol.for("react.context"),
    Hl = Symbol.for("react.forward_ref"),
    Vl = Symbol.for("react.suspense"),
    ul = Symbol.for("react.suspense_list"),
    G = Symbol.for("react.memo"),
    W = Symbol.for("react.lazy"),
    ol = Symbol.for("react.activity"),
    it = Symbol.for("react.memo_cache_sentinel"),
    Pl = Symbol.iterator;
  function Tl(l) {
    return l === null || typeof l != "object"
      ? null
      : ((l = (Pl && l[Pl]) || l["@@iterator"]),
        typeof l == "function" ? l : null);
  }
  var at = Symbol.for("react.client.reference");
  function el(l) {
    if (l == null) return null;
    if (typeof l == "function")
      return l.$$typeof === at ? null : l.displayName || l.name || null;
    if (typeof l == "string") return l;
    switch (l) {
      case fl:
        return "Fragment";
      case Ol:
        return "Profiler";
      case H:
        return "StrictMode";
      case Vl:
        return "Suspense";
      case ul:
        return "SuspenseList";
      case ol:
        return "Activity";
    }
    if (typeof l == "object")
      switch (l.$$typeof) {
        case V:
          return "Portal";
        case Cl:
          return l.displayName || "Context";
        case Zl:
          return (l._context.displayName || "Context") + ".Consumer";
        case Hl:
          var t = l.render;
          return (
            (l = l.displayName),
            l ||
              ((l = t.displayName || t.name || ""),
              (l = l !== "" ? "ForwardRef(" + l + ")" : "ForwardRef")),
            l
          );
        case G:
          return (
            (t = l.displayName || null),
            t !== null ? t : el(l.type) || "Memo"
          );
        case W:
          ((t = l._payload), (l = l._init));
          try {
            return el(l(t));
          } catch {}
      }
    return null;
  }
  var Dl = Array.isArray,
    T = Q.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
    D = x.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
    K = { pending: !1, data: null, method: null, action: null },
    bl = [],
    zl = -1;
  function r(l) {
    return { current: l };
  }
  function A(l) {
    0 > zl || ((l.current = bl[zl]), (bl[zl] = null), zl--);
  }
  function C(l, t) {
    (zl++, (bl[zl] = l.current), (l.current = t));
  }
  var N = r(null),
    F = r(null),
    ll = r(null),
    yl = r(null);
  function kl(l, t) {
    switch ((C(ll, t), C(F, l), C(N, null), t.nodeType)) {
      case 9:
      case 11:
        l = (l = t.documentElement) && (l = l.namespaceURI) ? ar(l) : 0;
        break;
      default:
        if (((l = t.tagName), (t = t.namespaceURI)))
          ((t = ar(t)), (l = ur(t, l)));
        else
          switch (l) {
            case "svg":
              l = 1;
              break;
            case "math":
              l = 2;
              break;
            default:
              l = 0;
          }
    }
    (A(N), C(N, l));
  }
  function Rl() {
    (A(N), A(F), A(ll));
  }
  function ee(l) {
    l.memoizedState !== null && C(yl, l);
    var t = N.current,
      e = ur(t, l.type);
    t !== e && (C(F, l), C(N, e));
  }
  function ae(l) {
    (F.current === l && (A(N), A(F)),
      yl.current === l && (A(yl), (on._currentValue = K)));
  }
  var Da, Ra;
  function ue(l) {
    if (Da === void 0)
      try {
        throw Error();
      } catch (e) {
        var t = e.stack.trim().match(/\n( *(at )?)/);
        ((Da = (t && t[1]) || ""),
          (Ra =
            -1 <
            e.stack.indexOf(`
    at`)
              ? " (<anonymous>)"
              : -1 < e.stack.indexOf("@")
                ? "@unknown:0:0"
                : ""));
      }
    return (
      `
` +
      Da +
      l +
      Ra
    );
  }
  var ia = !1;
  function ca(l, t) {
    if (!l || ia) return "";
    ia = !0;
    var e = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var a = {
        DetermineComponentFrameRoot: function () {
          try {
            if (t) {
              var M = function () {
                throw Error();
              };
              if (
                (Object.defineProperty(M.prototype, "props", {
                  set: function () {
                    throw Error();
                  },
                }),
                typeof Reflect == "object" && Reflect.construct)
              ) {
                try {
                  Reflect.construct(M, []);
                } catch (b) {
                  var v = b;
                }
                Reflect.construct(l, [], M);
              } else {
                try {
                  M.call();
                } catch (b) {
                  v = b;
                }
                l.call(M.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (b) {
                v = b;
              }
              (M = l()) &&
                typeof M.catch == "function" &&
                M.catch(function () {});
            }
          } catch (b) {
            if (b && v && typeof b.stack == "string") return [b.stack, v.stack];
          }
          return [null, null];
        },
      };
      a.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var u = Object.getOwnPropertyDescriptor(
        a.DetermineComponentFrameRoot,
        "name",
      );
      u &&
        u.configurable &&
        Object.defineProperty(a.DetermineComponentFrameRoot, "name", {
          value: "DetermineComponentFrameRoot",
        });
      var n = a.DetermineComponentFrameRoot(),
        i = n[0],
        c = n[1];
      if (i && c) {
        var o = i.split(`
`),
          g = c.split(`
`);
        for (
          u = a = 0;
          a < o.length && !o[a].includes("DetermineComponentFrameRoot");
        )
          a++;
        for (; u < g.length && !g[u].includes("DetermineComponentFrameRoot"); )
          u++;
        if (a === o.length || u === g.length)
          for (
            a = o.length - 1, u = g.length - 1;
            1 <= a && 0 <= u && o[a] !== g[u];
          )
            u--;
        for (; 1 <= a && 0 <= u; a--, u--)
          if (o[a] !== g[u]) {
            if (a !== 1 || u !== 1)
              do
                if ((a--, u--, 0 > u || o[a] !== g[u])) {
                  var z =
                    `
` + o[a].replace(" at new ", " at ");
                  return (
                    l.displayName &&
                      z.includes("<anonymous>") &&
                      (z = z.replace("<anonymous>", l.displayName)),
                    z
                  );
                }
              while (1 <= a && 0 <= u);
            break;
          }
      }
    } finally {
      ((ia = !1), (Error.prepareStackTrace = e));
    }
    return (e = l ? l.displayName || l.name : "") ? ue(e) : "";
  }
  function fa(l, t) {
    switch (l.tag) {
      case 26:
      case 27:
      case 5:
        return ue(l.type);
      case 16:
        return ue("Lazy");
      case 13:
        return l.child !== t && t !== null
          ? ue("Suspense Fallback")
          : ue("Suspense");
      case 19:
        return ue("SuspenseList");
      case 0:
      case 15:
        return ca(l.type, !1);
      case 11:
        return ca(l.type.render, !1);
      case 1:
        return ca(l.type, !0);
      case 31:
        return ue("Activity");
      default:
        return "";
    }
  }
  function gn(l) {
    try {
      var t = "",
        e = null;
      do ((t += fa(l, e)), (e = l), (l = l.return));
      while (l);
      return t;
    } catch (a) {
      return (
        `
Error generating stack: ` +
        a.message +
        `
` +
        a.stack
      );
    }
  }
  var Ua = Object.prototype.hasOwnProperty,
    mu = f.unstable_scheduleCallback,
    gu = f.unstable_cancelCallback,
    Ri = f.unstable_shouldYield,
    Ce = f.unstable_requestPaint,
    vl = f.unstable_now,
    vu = f.unstable_getCurrentPriorityLevel,
    vn = f.unstable_ImmediatePriority,
    wt = f.unstable_UserBlockingPriority,
    oa = f.unstable_NormalPriority,
    He = f.unstable_LowPriority,
    Su = f.unstable_IdlePriority,
    sa = f.log,
    ut = f.unstable_setDisableYieldValue,
    Be = null,
    Ul = null;
  function Gl(l) {
    if (
      (typeof sa == "function" && ut(l),
      Ul && typeof Ul.setStrictMode == "function")
    )
      try {
        Ul.setStrictMode(Be, l);
      } catch {}
  }
  var mt = Math.clz32 ? Math.clz32 : Ui,
    bu = Math.log,
    pu = Math.LN2;
  function Ui(l) {
    return ((l >>>= 0), l === 0 ? 32 : (31 - ((bu(l) / pu) | 0)) | 0);
  }
  var re = 256,
    kt = 262144,
    ja = 4194304;
  function de(l) {
    var t = l & 42;
    if (t !== 0) return t;
    switch (l & -l) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return l & 261888;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return l & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return l & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return l;
    }
  }
  function Ca(l, t, e) {
    var a = l.pendingLanes;
    if (a === 0) return 0;
    var u = 0,
      n = l.suspendedLanes,
      i = l.pingedLanes;
    l = l.warmLanes;
    var c = a & 134217727;
    return (
      c !== 0
        ? ((a = c & ~n),
          a !== 0
            ? (u = de(a))
            : ((i &= c),
              i !== 0
                ? (u = de(i))
                : e || ((e = c & ~l), e !== 0 && (u = de(e)))))
        : ((c = a & ~n),
          c !== 0
            ? (u = de(c))
            : i !== 0
              ? (u = de(i))
              : e || ((e = a & ~l), e !== 0 && (u = de(e)))),
      u === 0
        ? 0
        : t !== 0 &&
            t !== u &&
            (t & n) === 0 &&
            ((n = u & -u),
            (e = t & -t),
            n >= e || (n === 32 && (e & 4194048) !== 0))
          ? t
          : u
    );
  }
  function ra(l, t) {
    return (l.pendingLanes & ~(l.suspendedLanes & ~l.pingedLanes) & t) === 0;
  }
  function Sn(l, t) {
    switch (l) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return t + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function bn() {
    var l = ja;
    return ((ja <<= 1), (ja & 62914560) === 0 && (ja = 4194304), l);
  }
  function Tu(l) {
    for (var t = [], e = 0; 31 > e; e++) t.push(l);
    return t;
  }
  function Wt(l, t) {
    ((l.pendingLanes |= t),
      t !== 268435456 &&
        ((l.suspendedLanes = 0), (l.pingedLanes = 0), (l.warmLanes = 0)));
  }
  function da(l, t, e, a, u, n) {
    var i = l.pendingLanes;
    ((l.pendingLanes = e),
      (l.suspendedLanes = 0),
      (l.pingedLanes = 0),
      (l.warmLanes = 0),
      (l.expiredLanes &= e),
      (l.entangledLanes &= e),
      (l.errorRecoveryDisabledLanes &= e),
      (l.shellSuspendCounter = 0));
    var c = l.entanglements,
      o = l.expirationTimes,
      g = l.hiddenUpdates;
    for (e = i & ~e; 0 < e; ) {
      var z = 31 - mt(e),
        M = 1 << z;
      ((c[z] = 0), (o[z] = -1));
      var v = g[z];
      if (v !== null)
        for (g[z] = null, z = 0; z < v.length; z++) {
          var b = v[z];
          b !== null && (b.lane &= -536870913);
        }
      e &= ~M;
    }
    (a !== 0 && Bl(l, a, 0),
      n !== 0 && u === 0 && l.tag !== 0 && (l.suspendedLanes |= n & ~(i & ~t)));
  }
  function Bl(l, t, e) {
    ((l.pendingLanes |= t), (l.suspendedLanes &= ~t));
    var a = 31 - mt(t);
    ((l.entangledLanes |= t),
      (l.entanglements[a] = l.entanglements[a] | 1073741824 | (e & 261930)));
  }
  function zu(l, t) {
    var e = (l.entangledLanes |= t);
    for (l = l.entanglements; e; ) {
      var a = 31 - mt(e),
        u = 1 << a;
      ((u & t) | (l[a] & t) && (l[a] |= t), (e &= ~u));
    }
  }
  function Eu(l, t) {
    var e = t & -t;
    return (
      (e = (e & 42) !== 0 ? 1 : Ha(e)),
      (e & (l.suspendedLanes | t)) !== 0 ? 0 : e
    );
  }
  function Ha(l) {
    switch (l) {
      case 2:
        l = 1;
        break;
      case 8:
        l = 4;
        break;
      case 32:
        l = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        l = 128;
        break;
      case 268435456:
        l = 134217728;
        break;
      default:
        l = 0;
    }
    return l;
  }
  function vt(l) {
    return (
      (l &= -l),
      2 < l ? (8 < l ? ((l & 134217727) !== 0 ? 32 : 268435456) : 8) : 2
    );
  }
  function he() {
    var l = D.p;
    return l !== 0 ? l : ((l = window.event), l === void 0 ? 32 : _r(l.type));
  }
  function ye(l, t) {
    var e = D.p;
    try {
      return ((D.p = l), t());
    } finally {
      D.p = e;
    }
  }
  var St = Math.random().toString(36).slice(2),
    lt = "__reactFiber$" + St,
    ht = "__reactProps$" + St,
    Ne = "__reactContainer$" + St,
    _ = "__reactEvents$" + St,
    d = "__reactListeners$" + St,
    ql = "__reactHandles$" + St,
    Ht = "__reactResources$" + St,
    Jl = "__reactMarker$" + St;
  function ct(l) {
    (delete l[lt], delete l[ht], delete l[_], delete l[d], delete l[ql]);
  }
  function ne(l) {
    var t = l[lt];
    if (t) return t;
    for (var e = l.parentNode; e; ) {
      if ((t = e[Ne] || e[lt])) {
        if (
          ((e = t.alternate),
          t.child !== null || (e !== null && e.child !== null))
        )
          for (l = rr(l); l !== null; ) {
            if ((e = l[lt])) return e;
            l = rr(l);
          }
        return t;
      }
      ((l = e), (e = l.parentNode));
    }
    return null;
  }
  function bt(l) {
    if ((l = l[lt] || l[Ne])) {
      var t = l.tag;
      if (
        t === 5 ||
        t === 6 ||
        t === 13 ||
        t === 31 ||
        t === 26 ||
        t === 27 ||
        t === 3
      )
        return l;
    }
    return null;
  }
  function ie(l) {
    var t = l.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return l.stateNode;
    throw Error(h(33));
  }
  function $t(l) {
    var t = l[Ht];
    return (
      t ||
        (t = l[Ht] =
          { hoistableStyles: new Map(), hoistableScripts: new Map() }),
      t
    );
  }
  function nl(l) {
    l[Jl] = !0;
  }
  var Ft = new Set(),
    Au = {};
  function P(l, t) {
    (tt(l, t), tt(l + "Capture", t));
  }
  function tt(l, t) {
    for (Au[l] = t, l = 0; l < t.length; l++) Ft.add(t[l]);
  }
  var me = RegExp(
      "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$",
    ),
    $ = {},
    ft = {};
  function Bt(l) {
    return Ua.call(ft, l)
      ? !0
      : Ua.call($, l)
        ? !1
        : me.test(l)
          ? (ft[l] = !0)
          : (($[l] = !0), !1);
  }
  function dl(l, t, e) {
    if (Bt(t))
      if (e === null) l.removeAttribute(t);
      else {
        switch (typeof e) {
          case "undefined":
          case "function":
          case "symbol":
            l.removeAttribute(t);
            return;
          case "boolean":
            var a = t.toLowerCase().slice(0, 5);
            if (a !== "data-" && a !== "aria-") {
              l.removeAttribute(t);
              return;
            }
        }
        l.setAttribute(t, "" + e);
      }
  }
  function It(l, t, e) {
    if (e === null) l.removeAttribute(t);
    else {
      switch (typeof e) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          l.removeAttribute(t);
          return;
      }
      l.setAttribute(t, "" + e);
    }
  }
  function Nt(l, t, e, a) {
    if (a === null) l.removeAttribute(e);
    else {
      switch (typeof a) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          l.removeAttribute(e);
          return;
      }
      l.setAttributeNS(t, e, "" + a);
    }
  }
  function Yt(l) {
    switch (typeof l) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return l;
      case "object":
        return l;
      default:
        return "";
    }
  }
  function kf(l) {
    var t = l.type;
    return (
      (l = l.nodeName) &&
      l.toLowerCase() === "input" &&
      (t === "checkbox" || t === "radio")
    );
  }
  function wr(l, t, e) {
    var a = Object.getOwnPropertyDescriptor(l.constructor.prototype, t);
    if (
      !l.hasOwnProperty(t) &&
      typeof a < "u" &&
      typeof a.get == "function" &&
      typeof a.set == "function"
    ) {
      var u = a.get,
        n = a.set;
      return (
        Object.defineProperty(l, t, {
          configurable: !0,
          get: function () {
            return u.call(this);
          },
          set: function (i) {
            ((e = "" + i), n.call(this, i));
          },
        }),
        Object.defineProperty(l, t, { enumerable: a.enumerable }),
        {
          getValue: function () {
            return e;
          },
          setValue: function (i) {
            e = "" + i;
          },
          stopTracking: function () {
            ((l._valueTracker = null), delete l[t]);
          },
        }
      );
    }
  }
  function ji(l) {
    if (!l._valueTracker) {
      var t = kf(l) ? "checked" : "value";
      l._valueTracker = wr(l, t, "" + l[t]);
    }
  }
  function Wf(l) {
    if (!l) return !1;
    var t = l._valueTracker;
    if (!t) return !0;
    var e = t.getValue(),
      a = "";
    return (
      l && (a = kf(l) ? (l.checked ? "true" : "false") : l.value),
      (l = a),
      l !== e ? (t.setValue(l), !0) : !1
    );
  }
  function pn(l) {
    if (
      ((l = l || (typeof document < "u" ? document : void 0)), typeof l > "u")
    )
      return null;
    try {
      return l.activeElement || l.body;
    } catch {
      return l.body;
    }
  }
  var kr = /[\n"\\]/g;
  function qt(l) {
    return l.replace(kr, function (t) {
      return "\\" + t.charCodeAt(0).toString(16) + " ";
    });
  }
  function Ci(l, t, e, a, u, n, i, c) {
    ((l.name = ""),
      i != null &&
      typeof i != "function" &&
      typeof i != "symbol" &&
      typeof i != "boolean"
        ? (l.type = i)
        : l.removeAttribute("type"),
      t != null
        ? i === "number"
          ? ((t === 0 && l.value === "") || l.value != t) &&
            (l.value = "" + Yt(t))
          : l.value !== "" + Yt(t) && (l.value = "" + Yt(t))
        : (i !== "submit" && i !== "reset") || l.removeAttribute("value"),
      t != null
        ? Hi(l, i, Yt(t))
        : e != null
          ? Hi(l, i, Yt(e))
          : a != null && l.removeAttribute("value"),
      u == null && n != null && (l.defaultChecked = !!n),
      u != null &&
        (l.checked = u && typeof u != "function" && typeof u != "symbol"),
      c != null &&
      typeof c != "function" &&
      typeof c != "symbol" &&
      typeof c != "boolean"
        ? (l.name = "" + Yt(c))
        : l.removeAttribute("name"));
  }
  function $f(l, t, e, a, u, n, i, c) {
    if (
      (n != null &&
        typeof n != "function" &&
        typeof n != "symbol" &&
        typeof n != "boolean" &&
        (l.type = n),
      t != null || e != null)
    ) {
      if (!((n !== "submit" && n !== "reset") || t != null)) {
        ji(l);
        return;
      }
      ((e = e != null ? "" + Yt(e) : ""),
        (t = t != null ? "" + Yt(t) : e),
        c || t === l.value || (l.value = t),
        (l.defaultValue = t));
    }
    ((a = a ?? u),
      (a = typeof a != "function" && typeof a != "symbol" && !!a),
      (l.checked = c ? l.checked : !!a),
      (l.defaultChecked = !!a),
      i != null &&
        typeof i != "function" &&
        typeof i != "symbol" &&
        typeof i != "boolean" &&
        (l.name = i),
      ji(l));
  }
  function Hi(l, t, e) {
    (t === "number" && pn(l.ownerDocument) === l) ||
      l.defaultValue === "" + e ||
      (l.defaultValue = "" + e);
  }
  function Ba(l, t, e, a) {
    if (((l = l.options), t)) {
      t = {};
      for (var u = 0; u < e.length; u++) t["$" + e[u]] = !0;
      for (e = 0; e < l.length; e++)
        ((u = t.hasOwnProperty("$" + l[e].value)),
          l[e].selected !== u && (l[e].selected = u),
          u && a && (l[e].defaultSelected = !0));
    } else {
      for (e = "" + Yt(e), t = null, u = 0; u < l.length; u++) {
        if (l[u].value === e) {
          ((l[u].selected = !0), a && (l[u].defaultSelected = !0));
          return;
        }
        t !== null || l[u].disabled || (t = l[u]);
      }
      t !== null && (t.selected = !0);
    }
  }
  function Ff(l, t, e) {
    if (
      t != null &&
      ((t = "" + Yt(t)), t !== l.value && (l.value = t), e == null)
    ) {
      l.defaultValue !== t && (l.defaultValue = t);
      return;
    }
    l.defaultValue = e != null ? "" + Yt(e) : "";
  }
  function If(l, t, e, a) {
    if (t == null) {
      if (a != null) {
        if (e != null) throw Error(h(92));
        if (Dl(a)) {
          if (1 < a.length) throw Error(h(93));
          a = a[0];
        }
        e = a;
      }
      (e == null && (e = ""), (t = e));
    }
    ((e = Yt(t)),
      (l.defaultValue = e),
      (a = l.textContent),
      a === e && a !== "" && a !== null && (l.value = a),
      ji(l));
  }
  function Na(l, t) {
    if (t) {
      var e = l.firstChild;
      if (e && e === l.lastChild && e.nodeType === 3) {
        e.nodeValue = t;
        return;
      }
    }
    l.textContent = t;
  }
  var Wr = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " ",
    ),
  );
  function Pf(l, t, e) {
    var a = t.indexOf("--") === 0;
    e == null || typeof e == "boolean" || e === ""
      ? a
        ? l.setProperty(t, "")
        : t === "float"
          ? (l.cssFloat = "")
          : (l[t] = "")
      : a
        ? l.setProperty(t, e)
        : typeof e != "number" || e === 0 || Wr.has(t)
          ? t === "float"
            ? (l.cssFloat = e)
            : (l[t] = ("" + e).trim())
          : (l[t] = e + "px");
  }
  function lo(l, t, e) {
    if (t != null && typeof t != "object") throw Error(h(62));
    if (((l = l.style), e != null)) {
      for (var a in e)
        !e.hasOwnProperty(a) ||
          (t != null && t.hasOwnProperty(a)) ||
          (a.indexOf("--") === 0
            ? l.setProperty(a, "")
            : a === "float"
              ? (l.cssFloat = "")
              : (l[a] = ""));
      for (var u in t)
        ((a = t[u]), t.hasOwnProperty(u) && e[u] !== a && Pf(l, u, a));
    } else for (var n in t) t.hasOwnProperty(n) && Pf(l, n, t[n]);
  }
  function Bi(l) {
    if (l.indexOf("-") === -1) return !1;
    switch (l) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var $r = new Map([
      ["acceptCharset", "accept-charset"],
      ["htmlFor", "for"],
      ["httpEquiv", "http-equiv"],
      ["crossOrigin", "crossorigin"],
      ["accentHeight", "accent-height"],
      ["alignmentBaseline", "alignment-baseline"],
      ["arabicForm", "arabic-form"],
      ["baselineShift", "baseline-shift"],
      ["capHeight", "cap-height"],
      ["clipPath", "clip-path"],
      ["clipRule", "clip-rule"],
      ["colorInterpolation", "color-interpolation"],
      ["colorInterpolationFilters", "color-interpolation-filters"],
      ["colorProfile", "color-profile"],
      ["colorRendering", "color-rendering"],
      ["dominantBaseline", "dominant-baseline"],
      ["enableBackground", "enable-background"],
      ["fillOpacity", "fill-opacity"],
      ["fillRule", "fill-rule"],
      ["floodColor", "flood-color"],
      ["floodOpacity", "flood-opacity"],
      ["fontFamily", "font-family"],
      ["fontSize", "font-size"],
      ["fontSizeAdjust", "font-size-adjust"],
      ["fontStretch", "font-stretch"],
      ["fontStyle", "font-style"],
      ["fontVariant", "font-variant"],
      ["fontWeight", "font-weight"],
      ["glyphName", "glyph-name"],
      ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
      ["glyphOrientationVertical", "glyph-orientation-vertical"],
      ["horizAdvX", "horiz-adv-x"],
      ["horizOriginX", "horiz-origin-x"],
      ["imageRendering", "image-rendering"],
      ["letterSpacing", "letter-spacing"],
      ["lightingColor", "lighting-color"],
      ["markerEnd", "marker-end"],
      ["markerMid", "marker-mid"],
      ["markerStart", "marker-start"],
      ["overlinePosition", "overline-position"],
      ["overlineThickness", "overline-thickness"],
      ["paintOrder", "paint-order"],
      ["panose-1", "panose-1"],
      ["pointerEvents", "pointer-events"],
      ["renderingIntent", "rendering-intent"],
      ["shapeRendering", "shape-rendering"],
      ["stopColor", "stop-color"],
      ["stopOpacity", "stop-opacity"],
      ["strikethroughPosition", "strikethrough-position"],
      ["strikethroughThickness", "strikethrough-thickness"],
      ["strokeDasharray", "stroke-dasharray"],
      ["strokeDashoffset", "stroke-dashoffset"],
      ["strokeLinecap", "stroke-linecap"],
      ["strokeLinejoin", "stroke-linejoin"],
      ["strokeMiterlimit", "stroke-miterlimit"],
      ["strokeOpacity", "stroke-opacity"],
      ["strokeWidth", "stroke-width"],
      ["textAnchor", "text-anchor"],
      ["textDecoration", "text-decoration"],
      ["textRendering", "text-rendering"],
      ["transformOrigin", "transform-origin"],
      ["underlinePosition", "underline-position"],
      ["underlineThickness", "underline-thickness"],
      ["unicodeBidi", "unicode-bidi"],
      ["unicodeRange", "unicode-range"],
      ["unitsPerEm", "units-per-em"],
      ["vAlphabetic", "v-alphabetic"],
      ["vHanging", "v-hanging"],
      ["vIdeographic", "v-ideographic"],
      ["vMathematical", "v-mathematical"],
      ["vectorEffect", "vector-effect"],
      ["vertAdvY", "vert-adv-y"],
      ["vertOriginX", "vert-origin-x"],
      ["vertOriginY", "vert-origin-y"],
      ["wordSpacing", "word-spacing"],
      ["writingMode", "writing-mode"],
      ["xmlnsXlink", "xmlns:xlink"],
      ["xHeight", "x-height"],
    ]),
    Fr =
      /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function Tn(l) {
    return Fr.test("" + l)
      ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
      : l;
  }
  function ge() {}
  var Ni = null;
  function Yi(l) {
    return (
      (l = l.target || l.srcElement || window),
      l.correspondingUseElement && (l = l.correspondingUseElement),
      l.nodeType === 3 ? l.parentNode : l
    );
  }
  var Ya = null,
    qa = null;
  function to(l) {
    var t = bt(l);
    if (t && (l = t.stateNode)) {
      var e = l[ht] || null;
      l: switch (((l = t.stateNode), t.type)) {
        case "input":
          if (
            (Ci(
              l,
              e.value,
              e.defaultValue,
              e.defaultValue,
              e.checked,
              e.defaultChecked,
              e.type,
              e.name,
            ),
            (t = e.name),
            e.type === "radio" && t != null)
          ) {
            for (e = l; e.parentNode; ) e = e.parentNode;
            for (
              e = e.querySelectorAll(
                'input[name="' + qt("" + t) + '"][type="radio"]',
              ),
                t = 0;
              t < e.length;
              t++
            ) {
              var a = e[t];
              if (a !== l && a.form === l.form) {
                var u = a[ht] || null;
                if (!u) throw Error(h(90));
                Ci(
                  a,
                  u.value,
                  u.defaultValue,
                  u.defaultValue,
                  u.checked,
                  u.defaultChecked,
                  u.type,
                  u.name,
                );
              }
            }
            for (t = 0; t < e.length; t++)
              ((a = e[t]), a.form === l.form && Wf(a));
          }
          break l;
        case "textarea":
          Ff(l, e.value, e.defaultValue);
          break l;
        case "select":
          ((t = e.value), t != null && Ba(l, !!e.multiple, t, !1));
      }
    }
  }
  var qi = !1;
  function eo(l, t, e) {
    if (qi) return l(t, e);
    qi = !0;
    try {
      var a = l(t);
      return a;
    } finally {
      if (
        ((qi = !1),
        (Ya !== null || qa !== null) &&
          (fi(), Ya && ((t = Ya), (l = qa), (qa = Ya = null), to(t), l)))
      )
        for (t = 0; t < l.length; t++) to(l[t]);
    }
  }
  function Mu(l, t) {
    var e = l.stateNode;
    if (e === null) return null;
    var a = e[ht] || null;
    if (a === null) return null;
    e = a[t];
    l: switch (t) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        ((a = !a.disabled) ||
          ((l = l.type),
          (a = !(
            l === "button" ||
            l === "input" ||
            l === "select" ||
            l === "textarea"
          ))),
          (l = !a));
        break l;
      default:
        l = !1;
    }
    if (l) return null;
    if (e && typeof e != "function") throw Error(h(231, t, typeof e));
    return e;
  }
  var ve = !(
      typeof window > "u" ||
      typeof window.document > "u" ||
      typeof window.document.createElement > "u"
    ),
    Xi = !1;
  if (ve)
    try {
      var xu = {};
      (Object.defineProperty(xu, "passive", {
        get: function () {
          Xi = !0;
        },
      }),
        window.addEventListener("test", xu, xu),
        window.removeEventListener("test", xu, xu));
    } catch {
      Xi = !1;
    }
  var Ye = null,
    Gi = null,
    zn = null;
  function ao() {
    if (zn) return zn;
    var l,
      t = Gi,
      e = t.length,
      a,
      u = "value" in Ye ? Ye.value : Ye.textContent,
      n = u.length;
    for (l = 0; l < e && t[l] === u[l]; l++);
    var i = e - l;
    for (a = 1; a <= i && t[e - a] === u[n - a]; a++);
    return (zn = u.slice(l, 1 < a ? 1 - a : void 0));
  }
  function En(l) {
    var t = l.keyCode;
    return (
      "charCode" in l
        ? ((l = l.charCode), l === 0 && t === 13 && (l = 13))
        : (l = t),
      l === 10 && (l = 13),
      32 <= l || l === 13 ? l : 0
    );
  }
  function An() {
    return !0;
  }
  function uo() {
    return !1;
  }
  function pt(l) {
    function t(e, a, u, n, i) {
      ((this._reactName = e),
        (this._targetInst = u),
        (this.type = a),
        (this.nativeEvent = n),
        (this.target = i),
        (this.currentTarget = null));
      for (var c in l)
        l.hasOwnProperty(c) && ((e = l[c]), (this[c] = e ? e(n) : n[c]));
      return (
        (this.isDefaultPrevented = (
          n.defaultPrevented != null ? n.defaultPrevented : n.returnValue === !1
        )
          ? An
          : uo),
        (this.isPropagationStopped = uo),
        this
      );
    }
    return (
      j(t.prototype, {
        preventDefault: function () {
          this.defaultPrevented = !0;
          var e = this.nativeEvent;
          e &&
            (e.preventDefault
              ? e.preventDefault()
              : typeof e.returnValue != "unknown" && (e.returnValue = !1),
            (this.isDefaultPrevented = An));
        },
        stopPropagation: function () {
          var e = this.nativeEvent;
          e &&
            (e.stopPropagation
              ? e.stopPropagation()
              : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0),
            (this.isPropagationStopped = An));
        },
        persist: function () {},
        isPersistent: An,
      }),
      t
    );
  }
  var ha = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function (l) {
        return l.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0,
    },
    Mn = pt(ha),
    _u = j({}, ha, { view: 0, detail: 0 }),
    Ir = pt(_u),
    Qi,
    Li,
    Ou,
    xn = j({}, _u, {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      getModifierState: Vi,
      button: 0,
      buttons: 0,
      relatedTarget: function (l) {
        return l.relatedTarget === void 0
          ? l.fromElement === l.srcElement
            ? l.toElement
            : l.fromElement
          : l.relatedTarget;
      },
      movementX: function (l) {
        return "movementX" in l
          ? l.movementX
          : (l !== Ou &&
              (Ou && l.type === "mousemove"
                ? ((Qi = l.screenX - Ou.screenX), (Li = l.screenY - Ou.screenY))
                : (Li = Qi = 0),
              (Ou = l)),
            Qi);
      },
      movementY: function (l) {
        return "movementY" in l ? l.movementY : Li;
      },
    }),
    no = pt(xn),
    Pr = j({}, xn, { dataTransfer: 0 }),
    ld = pt(Pr),
    td = j({}, _u, { relatedTarget: 0 }),
    Zi = pt(td),
    ed = j({}, ha, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }),
    ad = pt(ed),
    ud = j({}, ha, {
      clipboardData: function (l) {
        return "clipboardData" in l ? l.clipboardData : window.clipboardData;
      },
    }),
    nd = pt(ud),
    id = j({}, ha, { data: 0 }),
    io = pt(id),
    cd = {
      Esc: "Escape",
      Spacebar: " ",
      Left: "ArrowLeft",
      Up: "ArrowUp",
      Right: "ArrowRight",
      Down: "ArrowDown",
      Del: "Delete",
      Win: "OS",
      Menu: "ContextMenu",
      Apps: "ContextMenu",
      Scroll: "ScrollLock",
      MozPrintableKey: "Unidentified",
    },
    fd = {
      8: "Backspace",
      9: "Tab",
      12: "Clear",
      13: "Enter",
      16: "Shift",
      17: "Control",
      18: "Alt",
      19: "Pause",
      20: "CapsLock",
      27: "Escape",
      32: " ",
      33: "PageUp",
      34: "PageDown",
      35: "End",
      36: "Home",
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      45: "Insert",
      46: "Delete",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "NumLock",
      145: "ScrollLock",
      224: "Meta",
    },
    od = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey",
    };
  function sd(l) {
    var t = this.nativeEvent;
    return t.getModifierState
      ? t.getModifierState(l)
      : (l = od[l])
        ? !!t[l]
        : !1;
  }
  function Vi() {
    return sd;
  }
  var rd = j({}, _u, {
      key: function (l) {
        if (l.key) {
          var t = cd[l.key] || l.key;
          if (t !== "Unidentified") return t;
        }
        return l.type === "keypress"
          ? ((l = En(l)), l === 13 ? "Enter" : String.fromCharCode(l))
          : l.type === "keydown" || l.type === "keyup"
            ? fd[l.keyCode] || "Unidentified"
            : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: Vi,
      charCode: function (l) {
        return l.type === "keypress" ? En(l) : 0;
      },
      keyCode: function (l) {
        return l.type === "keydown" || l.type === "keyup" ? l.keyCode : 0;
      },
      which: function (l) {
        return l.type === "keypress"
          ? En(l)
          : l.type === "keydown" || l.type === "keyup"
            ? l.keyCode
            : 0;
      },
    }),
    dd = pt(rd),
    hd = j({}, xn, {
      pointerId: 0,
      width: 0,
      height: 0,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 0,
      isPrimary: 0,
    }),
    co = pt(hd),
    yd = j({}, _u, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: Vi,
    }),
    md = pt(yd),
    gd = j({}, ha, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }),
    vd = pt(gd),
    Sd = j({}, xn, {
      deltaX: function (l) {
        return "deltaX" in l
          ? l.deltaX
          : "wheelDeltaX" in l
            ? -l.wheelDeltaX
            : 0;
      },
      deltaY: function (l) {
        return "deltaY" in l
          ? l.deltaY
          : "wheelDeltaY" in l
            ? -l.wheelDeltaY
            : "wheelDelta" in l
              ? -l.wheelDelta
              : 0;
      },
      deltaZ: 0,
      deltaMode: 0,
    }),
    bd = pt(Sd),
    pd = j({}, ha, { newState: 0, oldState: 0 }),
    Td = pt(pd),
    zd = [9, 13, 27, 32],
    Ji = ve && "CompositionEvent" in window,
    Du = null;
  ve && "documentMode" in document && (Du = document.documentMode);
  var Ed = ve && "TextEvent" in window && !Du,
    fo = ve && (!Ji || (Du && 8 < Du && 11 >= Du)),
    oo = " ",
    so = !1;
  function ro(l, t) {
    switch (l) {
      case "keyup":
        return zd.indexOf(t.keyCode) !== -1;
      case "keydown":
        return t.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function ho(l) {
    return (
      (l = l.detail),
      typeof l == "object" && "data" in l ? l.data : null
    );
  }
  var Xa = !1;
  function Ad(l, t) {
    switch (l) {
      case "compositionend":
        return ho(t);
      case "keypress":
        return t.which !== 32 ? null : ((so = !0), oo);
      case "textInput":
        return ((l = t.data), l === oo && so ? null : l);
      default:
        return null;
    }
  }
  function Md(l, t) {
    if (Xa)
      return l === "compositionend" || (!Ji && ro(l, t))
        ? ((l = ao()), (zn = Gi = Ye = null), (Xa = !1), l)
        : null;
    switch (l) {
      case "paste":
        return null;
      case "keypress":
        if (!(t.ctrlKey || t.altKey || t.metaKey) || (t.ctrlKey && t.altKey)) {
          if (t.char && 1 < t.char.length) return t.char;
          if (t.which) return String.fromCharCode(t.which);
        }
        return null;
      case "compositionend":
        return fo && t.locale !== "ko" ? null : t.data;
      default:
        return null;
    }
  }
  var xd = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0,
  };
  function yo(l) {
    var t = l && l.nodeName && l.nodeName.toLowerCase();
    return t === "input" ? !!xd[l.type] : t === "textarea";
  }
  function mo(l, t, e, a) {
    (Ya ? (qa ? qa.push(a) : (qa = [a])) : (Ya = a),
      (t = mi(t, "onChange")),
      0 < t.length &&
        ((e = new Mn("onChange", "change", null, e, a)),
        l.push({ event: e, listeners: t })));
  }
  var Ru = null,
    Uu = null;
  function _d(l) {
    F0(l, 0);
  }
  function _n(l) {
    var t = ie(l);
    if (Wf(t)) return l;
  }
  function go(l, t) {
    if (l === "change") return t;
  }
  var vo = !1;
  if (ve) {
    var Ki;
    if (ve) {
      var wi = "oninput" in document;
      if (!wi) {
        var So = document.createElement("div");
        (So.setAttribute("oninput", "return;"),
          (wi = typeof So.oninput == "function"));
      }
      Ki = wi;
    } else Ki = !1;
    vo = Ki && (!document.documentMode || 9 < document.documentMode);
  }
  function bo() {
    Ru && (Ru.detachEvent("onpropertychange", po), (Uu = Ru = null));
  }
  function po(l) {
    if (l.propertyName === "value" && _n(Uu)) {
      var t = [];
      (mo(t, Uu, l, Yi(l)), eo(_d, t));
    }
  }
  function Od(l, t, e) {
    l === "focusin"
      ? (bo(), (Ru = t), (Uu = e), Ru.attachEvent("onpropertychange", po))
      : l === "focusout" && bo();
  }
  function Dd(l) {
    if (l === "selectionchange" || l === "keyup" || l === "keydown")
      return _n(Uu);
  }
  function Rd(l, t) {
    if (l === "click") return _n(t);
  }
  function Ud(l, t) {
    if (l === "input" || l === "change") return _n(t);
  }
  function jd(l, t) {
    return (l === t && (l !== 0 || 1 / l === 1 / t)) || (l !== l && t !== t);
  }
  var _t = typeof Object.is == "function" ? Object.is : jd;
  function ju(l, t) {
    if (_t(l, t)) return !0;
    if (
      typeof l != "object" ||
      l === null ||
      typeof t != "object" ||
      t === null
    )
      return !1;
    var e = Object.keys(l),
      a = Object.keys(t);
    if (e.length !== a.length) return !1;
    for (a = 0; a < e.length; a++) {
      var u = e[a];
      if (!Ua.call(t, u) || !_t(l[u], t[u])) return !1;
    }
    return !0;
  }
  function To(l) {
    for (; l && l.firstChild; ) l = l.firstChild;
    return l;
  }
  function zo(l, t) {
    var e = To(l);
    l = 0;
    for (var a; e; ) {
      if (e.nodeType === 3) {
        if (((a = l + e.textContent.length), l <= t && a >= t))
          return { node: e, offset: t - l };
        l = a;
      }
      l: {
        for (; e; ) {
          if (e.nextSibling) {
            e = e.nextSibling;
            break l;
          }
          e = e.parentNode;
        }
        e = void 0;
      }
      e = To(e);
    }
  }
  function Eo(l, t) {
    return l && t
      ? l === t
        ? !0
        : l && l.nodeType === 3
          ? !1
          : t && t.nodeType === 3
            ? Eo(l, t.parentNode)
            : "contains" in l
              ? l.contains(t)
              : l.compareDocumentPosition
                ? !!(l.compareDocumentPosition(t) & 16)
                : !1
      : !1;
  }
  function Ao(l) {
    l =
      l != null &&
      l.ownerDocument != null &&
      l.ownerDocument.defaultView != null
        ? l.ownerDocument.defaultView
        : window;
    for (var t = pn(l.document); t instanceof l.HTMLIFrameElement; ) {
      try {
        var e = typeof t.contentWindow.location.href == "string";
      } catch {
        e = !1;
      }
      if (e) l = t.contentWindow;
      else break;
      t = pn(l.document);
    }
    return t;
  }
  function ki(l) {
    var t = l && l.nodeName && l.nodeName.toLowerCase();
    return (
      t &&
      ((t === "input" &&
        (l.type === "text" ||
          l.type === "search" ||
          l.type === "tel" ||
          l.type === "url" ||
          l.type === "password")) ||
        t === "textarea" ||
        l.contentEditable === "true")
    );
  }
  var Cd = ve && "documentMode" in document && 11 >= document.documentMode,
    Ga = null,
    Wi = null,
    Cu = null,
    $i = !1;
  function Mo(l, t, e) {
    var a =
      e.window === e ? e.document : e.nodeType === 9 ? e : e.ownerDocument;
    $i ||
      Ga == null ||
      Ga !== pn(a) ||
      ((a = Ga),
      "selectionStart" in a && ki(a)
        ? (a = { start: a.selectionStart, end: a.selectionEnd })
        : ((a = (
            (a.ownerDocument && a.ownerDocument.defaultView) ||
            window
          ).getSelection()),
          (a = {
            anchorNode: a.anchorNode,
            anchorOffset: a.anchorOffset,
            focusNode: a.focusNode,
            focusOffset: a.focusOffset,
          })),
      (Cu && ju(Cu, a)) ||
        ((Cu = a),
        (a = mi(Wi, "onSelect")),
        0 < a.length &&
          ((t = new Mn("onSelect", "select", null, t, e)),
          l.push({ event: t, listeners: a }),
          (t.target = Ga))));
  }
  function ya(l, t) {
    var e = {};
    return (
      (e[l.toLowerCase()] = t.toLowerCase()),
      (e["Webkit" + l] = "webkit" + t),
      (e["Moz" + l] = "moz" + t),
      e
    );
  }
  var Qa = {
      animationend: ya("Animation", "AnimationEnd"),
      animationiteration: ya("Animation", "AnimationIteration"),
      animationstart: ya("Animation", "AnimationStart"),
      transitionrun: ya("Transition", "TransitionRun"),
      transitionstart: ya("Transition", "TransitionStart"),
      transitioncancel: ya("Transition", "TransitionCancel"),
      transitionend: ya("Transition", "TransitionEnd"),
    },
    Fi = {},
    xo = {};
  ve &&
    ((xo = document.createElement("div").style),
    "AnimationEvent" in window ||
      (delete Qa.animationend.animation,
      delete Qa.animationiteration.animation,
      delete Qa.animationstart.animation),
    "TransitionEvent" in window || delete Qa.transitionend.transition);
  function ma(l) {
    if (Fi[l]) return Fi[l];
    if (!Qa[l]) return l;
    var t = Qa[l],
      e;
    for (e in t) if (t.hasOwnProperty(e) && e in xo) return (Fi[l] = t[e]);
    return l;
  }
  var _o = ma("animationend"),
    Oo = ma("animationiteration"),
    Do = ma("animationstart"),
    Hd = ma("transitionrun"),
    Bd = ma("transitionstart"),
    Nd = ma("transitioncancel"),
    Ro = ma("transitionend"),
    Uo = new Map(),
    Ii =
      "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
        " ",
      );
  Ii.push("scrollEnd");
  function Pt(l, t) {
    (Uo.set(l, t), P(t, [l]));
  }
  var On =
      typeof reportError == "function"
        ? reportError
        : function (l) {
            if (
              typeof window == "object" &&
              typeof window.ErrorEvent == "function"
            ) {
              var t = new window.ErrorEvent("error", {
                bubbles: !0,
                cancelable: !0,
                message:
                  typeof l == "object" &&
                  l !== null &&
                  typeof l.message == "string"
                    ? String(l.message)
                    : String(l),
                error: l,
              });
              if (!window.dispatchEvent(t)) return;
            } else if (
              typeof process == "object" &&
              typeof process.emit == "function"
            ) {
              process.emit("uncaughtException", l);
              return;
            }
            console.error(l);
          },
    Xt = [],
    La = 0,
    Pi = 0;
  function Dn() {
    for (var l = La, t = (Pi = La = 0); t < l; ) {
      var e = Xt[t];
      Xt[t++] = null;
      var a = Xt[t];
      Xt[t++] = null;
      var u = Xt[t];
      Xt[t++] = null;
      var n = Xt[t];
      if (((Xt[t++] = null), a !== null && u !== null)) {
        var i = a.pending;
        (i === null ? (u.next = u) : ((u.next = i.next), (i.next = u)),
          (a.pending = u));
      }
      n !== 0 && jo(e, u, n);
    }
  }
  function Rn(l, t, e, a) {
    ((Xt[La++] = l),
      (Xt[La++] = t),
      (Xt[La++] = e),
      (Xt[La++] = a),
      (Pi |= a),
      (l.lanes |= a),
      (l = l.alternate),
      l !== null && (l.lanes |= a));
  }
  function lc(l, t, e, a) {
    return (Rn(l, t, e, a), Un(l));
  }
  function ga(l, t) {
    return (Rn(l, null, null, t), Un(l));
  }
  function jo(l, t, e) {
    l.lanes |= e;
    var a = l.alternate;
    a !== null && (a.lanes |= e);
    for (var u = !1, n = l.return; n !== null; )
      ((n.childLanes |= e),
        (a = n.alternate),
        a !== null && (a.childLanes |= e),
        n.tag === 22 &&
          ((l = n.stateNode), l === null || l._visibility & 1 || (u = !0)),
        (l = n),
        (n = n.return));
    return l.tag === 3
      ? ((n = l.stateNode),
        u &&
          t !== null &&
          ((u = 31 - mt(e)),
          (l = n.hiddenUpdates),
          (a = l[u]),
          a === null ? (l[u] = [t]) : a.push(t),
          (t.lane = e | 536870912)),
        n)
      : null;
  }
  function Un(l) {
    if (50 < tn) throw ((tn = 0), (sf = null), Error(h(185)));
    for (var t = l.return; t !== null; ) ((l = t), (t = l.return));
    return l.tag === 3 ? l.stateNode : null;
  }
  var Za = {};
  function Yd(l, t, e, a) {
    ((this.tag = l),
      (this.key = e),
      (this.sibling =
        this.child =
        this.return =
        this.stateNode =
        this.type =
        this.elementType =
          null),
      (this.index = 0),
      (this.refCleanup = this.ref = null),
      (this.pendingProps = t),
      (this.dependencies =
        this.memoizedState =
        this.updateQueue =
        this.memoizedProps =
          null),
      (this.mode = a),
      (this.subtreeFlags = this.flags = 0),
      (this.deletions = null),
      (this.childLanes = this.lanes = 0),
      (this.alternate = null));
  }
  function Ot(l, t, e, a) {
    return new Yd(l, t, e, a);
  }
  function tc(l) {
    return ((l = l.prototype), !(!l || !l.isReactComponent));
  }
  function Se(l, t) {
    var e = l.alternate;
    return (
      e === null
        ? ((e = Ot(l.tag, t, l.key, l.mode)),
          (e.elementType = l.elementType),
          (e.type = l.type),
          (e.stateNode = l.stateNode),
          (e.alternate = l),
          (l.alternate = e))
        : ((e.pendingProps = t),
          (e.type = l.type),
          (e.flags = 0),
          (e.subtreeFlags = 0),
          (e.deletions = null)),
      (e.flags = l.flags & 65011712),
      (e.childLanes = l.childLanes),
      (e.lanes = l.lanes),
      (e.child = l.child),
      (e.memoizedProps = l.memoizedProps),
      (e.memoizedState = l.memoizedState),
      (e.updateQueue = l.updateQueue),
      (t = l.dependencies),
      (e.dependencies =
        t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }),
      (e.sibling = l.sibling),
      (e.index = l.index),
      (e.ref = l.ref),
      (e.refCleanup = l.refCleanup),
      e
    );
  }
  function Co(l, t) {
    l.flags &= 65011714;
    var e = l.alternate;
    return (
      e === null
        ? ((l.childLanes = 0),
          (l.lanes = t),
          (l.child = null),
          (l.subtreeFlags = 0),
          (l.memoizedProps = null),
          (l.memoizedState = null),
          (l.updateQueue = null),
          (l.dependencies = null),
          (l.stateNode = null))
        : ((l.childLanes = e.childLanes),
          (l.lanes = e.lanes),
          (l.child = e.child),
          (l.subtreeFlags = 0),
          (l.deletions = null),
          (l.memoizedProps = e.memoizedProps),
          (l.memoizedState = e.memoizedState),
          (l.updateQueue = e.updateQueue),
          (l.type = e.type),
          (t = e.dependencies),
          (l.dependencies =
            t === null
              ? null
              : { lanes: t.lanes, firstContext: t.firstContext })),
      l
    );
  }
  function jn(l, t, e, a, u, n) {
    var i = 0;
    if (((a = l), typeof l == "function")) tc(l) && (i = 1);
    else if (typeof l == "string")
      i = Lh(l, e, N.current)
        ? 26
        : l === "html" || l === "head" || l === "body"
          ? 27
          : 5;
    else
      l: switch (l) {
        case ol:
          return (
            (l = Ot(31, e, t, u)),
            (l.elementType = ol),
            (l.lanes = n),
            l
          );
        case fl:
          return va(e.children, u, n, t);
        case H:
          ((i = 8), (u |= 24));
          break;
        case Ol:
          return (
            (l = Ot(12, e, t, u | 2)),
            (l.elementType = Ol),
            (l.lanes = n),
            l
          );
        case Vl:
          return (
            (l = Ot(13, e, t, u)),
            (l.elementType = Vl),
            (l.lanes = n),
            l
          );
        case ul:
          return (
            (l = Ot(19, e, t, u)),
            (l.elementType = ul),
            (l.lanes = n),
            l
          );
        default:
          if (typeof l == "object" && l !== null)
            switch (l.$$typeof) {
              case Cl:
                i = 10;
                break l;
              case Zl:
                i = 9;
                break l;
              case Hl:
                i = 11;
                break l;
              case G:
                i = 14;
                break l;
              case W:
                ((i = 16), (a = null));
                break l;
            }
          ((i = 29),
            (e = Error(h(130, l === null ? "null" : typeof l, ""))),
            (a = null));
      }
    return (
      (t = Ot(i, e, t, u)),
      (t.elementType = l),
      (t.type = a),
      (t.lanes = n),
      t
    );
  }
  function va(l, t, e, a) {
    return ((l = Ot(7, l, a, t)), (l.lanes = e), l);
  }
  function ec(l, t, e) {
    return ((l = Ot(6, l, null, t)), (l.lanes = e), l);
  }
  function Ho(l) {
    var t = Ot(18, null, null, 0);
    return ((t.stateNode = l), t);
  }
  function ac(l, t, e) {
    return (
      (t = Ot(4, l.children !== null ? l.children : [], l.key, t)),
      (t.lanes = e),
      (t.stateNode = {
        containerInfo: l.containerInfo,
        pendingChildren: null,
        implementation: l.implementation,
      }),
      t
    );
  }
  var Bo = new WeakMap();
  function Gt(l, t) {
    if (typeof l == "object" && l !== null) {
      var e = Bo.get(l);
      return e !== void 0
        ? e
        : ((t = { value: l, source: t, stack: gn(t) }), Bo.set(l, t), t);
    }
    return { value: l, source: t, stack: gn(t) };
  }
  var Va = [],
    Ja = 0,
    Cn = null,
    Hu = 0,
    Qt = [],
    Lt = 0,
    qe = null,
    ce = 1,
    fe = "";
  function be(l, t) {
    ((Va[Ja++] = Hu), (Va[Ja++] = Cn), (Cn = l), (Hu = t));
  }
  function No(l, t, e) {
    ((Qt[Lt++] = ce), (Qt[Lt++] = fe), (Qt[Lt++] = qe), (qe = l));
    var a = ce;
    l = fe;
    var u = 32 - mt(a) - 1;
    ((a &= ~(1 << u)), (e += 1));
    var n = 32 - mt(t) + u;
    if (30 < n) {
      var i = u - (u % 5);
      ((n = (a & ((1 << i) - 1)).toString(32)),
        (a >>= i),
        (u -= i),
        (ce = (1 << (32 - mt(t) + u)) | (e << u) | a),
        (fe = n + l));
    } else ((ce = (1 << n) | (e << u) | a), (fe = l));
  }
  function uc(l) {
    l.return !== null && (be(l, 1), No(l, 1, 0));
  }
  function nc(l) {
    for (; l === Cn; )
      ((Cn = Va[--Ja]), (Va[Ja] = null), (Hu = Va[--Ja]), (Va[Ja] = null));
    for (; l === qe; )
      ((qe = Qt[--Lt]),
        (Qt[Lt] = null),
        (fe = Qt[--Lt]),
        (Qt[Lt] = null),
        (ce = Qt[--Lt]),
        (Qt[Lt] = null));
  }
  function Yo(l, t) {
    ((Qt[Lt++] = ce),
      (Qt[Lt++] = fe),
      (Qt[Lt++] = qe),
      (ce = t.id),
      (fe = t.overflow),
      (qe = l));
  }
  var ot = null,
    Nl = null,
    hl = !1,
    Xe = null,
    Zt = !1,
    ic = Error(h(519));
  function Ge(l) {
    var t = Error(
      h(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1]
          ? "text"
          : "HTML",
        "",
      ),
    );
    throw (Bu(Gt(t, l)), ic);
  }
  function qo(l) {
    var t = l.stateNode,
      e = l.type,
      a = l.memoizedProps;
    switch (((t[lt] = l), (t[ht] = a), e)) {
      case "dialog":
        (cl("cancel", t), cl("close", t));
        break;
      case "iframe":
      case "object":
      case "embed":
        cl("load", t);
        break;
      case "video":
      case "audio":
        for (e = 0; e < an.length; e++) cl(an[e], t);
        break;
      case "source":
        cl("error", t);
        break;
      case "img":
      case "image":
      case "link":
        (cl("error", t), cl("load", t));
        break;
      case "details":
        cl("toggle", t);
        break;
      case "input":
        (cl("invalid", t),
          $f(
            t,
            a.value,
            a.defaultValue,
            a.checked,
            a.defaultChecked,
            a.type,
            a.name,
            !0,
          ));
        break;
      case "select":
        cl("invalid", t);
        break;
      case "textarea":
        (cl("invalid", t), If(t, a.value, a.defaultValue, a.children));
    }
    ((e = a.children),
      (typeof e != "string" && typeof e != "number" && typeof e != "bigint") ||
      t.textContent === "" + e ||
      a.suppressHydrationWarning === !0 ||
      tr(t.textContent, e)
        ? (a.popover != null && (cl("beforetoggle", t), cl("toggle", t)),
          a.onScroll != null && cl("scroll", t),
          a.onScrollEnd != null && cl("scrollend", t),
          a.onClick != null && (t.onclick = ge),
          (t = !0))
        : (t = !1),
      t || Ge(l, !0));
  }
  function Xo(l) {
    for (ot = l.return; ot; )
      switch (ot.tag) {
        case 5:
        case 31:
        case 13:
          Zt = !1;
          return;
        case 27:
        case 3:
          Zt = !0;
          return;
        default:
          ot = ot.return;
      }
  }
  function Ka(l) {
    if (l !== ot) return !1;
    if (!hl) return (Xo(l), (hl = !0), !1);
    var t = l.tag,
      e;
    if (
      ((e = t !== 3 && t !== 27) &&
        ((e = t === 5) &&
          ((e = l.type),
          (e =
            !(e !== "form" && e !== "button") || Mf(l.type, l.memoizedProps))),
        (e = !e)),
      e && Nl && Ge(l),
      Xo(l),
      t === 13)
    ) {
      if (((l = l.memoizedState), (l = l !== null ? l.dehydrated : null), !l))
        throw Error(h(317));
      Nl = sr(l);
    } else if (t === 31) {
      if (((l = l.memoizedState), (l = l !== null ? l.dehydrated : null), !l))
        throw Error(h(317));
      Nl = sr(l);
    } else
      t === 27
        ? ((t = Nl), la(l.type) ? ((l = Rf), (Rf = null), (Nl = l)) : (Nl = t))
        : (Nl = ot ? Jt(l.stateNode.nextSibling) : null);
    return !0;
  }
  function Sa() {
    ((Nl = ot = null), (hl = !1));
  }
  function cc() {
    var l = Xe;
    return (
      l !== null &&
        (At === null ? (At = l) : At.push.apply(At, l), (Xe = null)),
      l
    );
  }
  function Bu(l) {
    Xe === null ? (Xe = [l]) : Xe.push(l);
  }
  var fc = r(null),
    ba = null,
    pe = null;
  function Qe(l, t, e) {
    (C(fc, t._currentValue), (t._currentValue = e));
  }
  function Te(l) {
    ((l._currentValue = fc.current), A(fc));
  }
  function oc(l, t, e) {
    for (; l !== null; ) {
      var a = l.alternate;
      if (
        ((l.childLanes & t) !== t
          ? ((l.childLanes |= t), a !== null && (a.childLanes |= t))
          : a !== null && (a.childLanes & t) !== t && (a.childLanes |= t),
        l === e)
      )
        break;
      l = l.return;
    }
  }
  function sc(l, t, e, a) {
    var u = l.child;
    for (u !== null && (u.return = l); u !== null; ) {
      var n = u.dependencies;
      if (n !== null) {
        var i = u.child;
        n = n.firstContext;
        l: for (; n !== null; ) {
          var c = n;
          n = u;
          for (var o = 0; o < t.length; o++)
            if (c.context === t[o]) {
              ((n.lanes |= e),
                (c = n.alternate),
                c !== null && (c.lanes |= e),
                oc(n.return, e, l),
                a || (i = null));
              break l;
            }
          n = c.next;
        }
      } else if (u.tag === 18) {
        if (((i = u.return), i === null)) throw Error(h(341));
        ((i.lanes |= e),
          (n = i.alternate),
          n !== null && (n.lanes |= e),
          oc(i, e, l),
          (i = null));
      } else i = u.child;
      if (i !== null) i.return = u;
      else
        for (i = u; i !== null; ) {
          if (i === l) {
            i = null;
            break;
          }
          if (((u = i.sibling), u !== null)) {
            ((u.return = i.return), (i = u));
            break;
          }
          i = i.return;
        }
      u = i;
    }
  }
  function wa(l, t, e, a) {
    l = null;
    for (var u = t, n = !1; u !== null; ) {
      if (!n) {
        if ((u.flags & 524288) !== 0) n = !0;
        else if ((u.flags & 262144) !== 0) break;
      }
      if (u.tag === 10) {
        var i = u.alternate;
        if (i === null) throw Error(h(387));
        if (((i = i.memoizedProps), i !== null)) {
          var c = u.type;
          _t(u.pendingProps.value, i.value) ||
            (l !== null ? l.push(c) : (l = [c]));
        }
      } else if (u === yl.current) {
        if (((i = u.alternate), i === null)) throw Error(h(387));
        i.memoizedState.memoizedState !== u.memoizedState.memoizedState &&
          (l !== null ? l.push(on) : (l = [on]));
      }
      u = u.return;
    }
    (l !== null && sc(t, l, e, a), (t.flags |= 262144));
  }
  function Hn(l) {
    for (l = l.firstContext; l !== null; ) {
      if (!_t(l.context._currentValue, l.memoizedValue)) return !0;
      l = l.next;
    }
    return !1;
  }
  function pa(l) {
    ((ba = l),
      (pe = null),
      (l = l.dependencies),
      l !== null && (l.firstContext = null));
  }
  function st(l) {
    return Go(ba, l);
  }
  function Bn(l, t) {
    return (ba === null && pa(l), Go(l, t));
  }
  function Go(l, t) {
    var e = t._currentValue;
    if (((t = { context: t, memoizedValue: e, next: null }), pe === null)) {
      if (l === null) throw Error(h(308));
      ((pe = t),
        (l.dependencies = { lanes: 0, firstContext: t }),
        (l.flags |= 524288));
    } else pe = pe.next = t;
    return e;
  }
  var qd =
      typeof AbortController < "u"
        ? AbortController
        : function () {
            var l = [],
              t = (this.signal = {
                aborted: !1,
                addEventListener: function (e, a) {
                  l.push(a);
                },
              });
            this.abort = function () {
              ((t.aborted = !0),
                l.forEach(function (e) {
                  return e();
                }));
            };
          },
    Xd = f.unstable_scheduleCallback,
    Gd = f.unstable_NormalPriority,
    Wl = {
      $$typeof: Cl,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0,
    };
  function rc() {
    return { controller: new qd(), data: new Map(), refCount: 0 };
  }
  function Nu(l) {
    (l.refCount--,
      l.refCount === 0 &&
        Xd(Gd, function () {
          l.controller.abort();
        }));
  }
  var Yu = null,
    dc = 0,
    ka = 0,
    Wa = null;
  function Qd(l, t) {
    if (Yu === null) {
      var e = (Yu = []);
      ((dc = 0),
        (ka = gf()),
        (Wa = {
          status: "pending",
          value: void 0,
          then: function (a) {
            e.push(a);
          },
        }));
    }
    return (dc++, t.then(Qo, Qo), t);
  }
  function Qo() {
    if (--dc === 0 && Yu !== null) {
      Wa !== null && (Wa.status = "fulfilled");
      var l = Yu;
      ((Yu = null), (ka = 0), (Wa = null));
      for (var t = 0; t < l.length; t++) (0, l[t])();
    }
  }
  function Ld(l, t) {
    var e = [],
      a = {
        status: "pending",
        value: null,
        reason: null,
        then: function (u) {
          e.push(u);
        },
      };
    return (
      l.then(
        function () {
          ((a.status = "fulfilled"), (a.value = t));
          for (var u = 0; u < e.length; u++) (0, e[u])(t);
        },
        function (u) {
          for (a.status = "rejected", a.reason = u, u = 0; u < e.length; u++)
            (0, e[u])(void 0);
        },
      ),
      a
    );
  }
  var Lo = T.S;
  T.S = function (l, t) {
    ((M0 = vl()),
      typeof t == "object" &&
        t !== null &&
        typeof t.then == "function" &&
        Qd(l, t),
      Lo !== null && Lo(l, t));
  };
  var Ta = r(null);
  function hc() {
    var l = Ta.current;
    return l !== null ? l : jl.pooledCache;
  }
  function Nn(l, t) {
    t === null ? C(Ta, Ta.current) : C(Ta, t.pool);
  }
  function Zo() {
    var l = hc();
    return l === null ? null : { parent: Wl._currentValue, pool: l };
  }
  var $a = Error(h(460)),
    yc = Error(h(474)),
    Yn = Error(h(542)),
    qn = { then: function () {} };
  function Vo(l) {
    return ((l = l.status), l === "fulfilled" || l === "rejected");
  }
  function Jo(l, t, e) {
    switch (
      ((e = l[e]),
      e === void 0 ? l.push(t) : e !== t && (t.then(ge, ge), (t = e)),
      t.status)
    ) {
      case "fulfilled":
        return t.value;
      case "rejected":
        throw ((l = t.reason), wo(l), l);
      default:
        if (typeof t.status == "string") t.then(ge, ge);
        else {
          if (((l = jl), l !== null && 100 < l.shellSuspendCounter))
            throw Error(h(482));
          ((l = t),
            (l.status = "pending"),
            l.then(
              function (a) {
                if (t.status === "pending") {
                  var u = t;
                  ((u.status = "fulfilled"), (u.value = a));
                }
              },
              function (a) {
                if (t.status === "pending") {
                  var u = t;
                  ((u.status = "rejected"), (u.reason = a));
                }
              },
            ));
        }
        switch (t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw ((l = t.reason), wo(l), l);
        }
        throw ((Ea = t), $a);
    }
  }
  function za(l) {
    try {
      var t = l._init;
      return t(l._payload);
    } catch (e) {
      throw e !== null && typeof e == "object" && typeof e.then == "function"
        ? ((Ea = e), $a)
        : e;
    }
  }
  var Ea = null;
  function Ko() {
    if (Ea === null) throw Error(h(459));
    var l = Ea;
    return ((Ea = null), l);
  }
  function wo(l) {
    if (l === $a || l === Yn) throw Error(h(483));
  }
  var Fa = null,
    qu = 0;
  function Xn(l) {
    var t = qu;
    return ((qu += 1), Fa === null && (Fa = []), Jo(Fa, l, t));
  }
  function Xu(l, t) {
    ((t = t.props.ref), (l.ref = t !== void 0 ? t : null));
  }
  function Gn(l, t) {
    throw t.$$typeof === Y
      ? Error(h(525))
      : ((l = Object.prototype.toString.call(t)),
        Error(
          h(
            31,
            l === "[object Object]"
              ? "object with keys {" + Object.keys(t).join(", ") + "}"
              : l,
          ),
        ));
  }
  function ko(l) {
    function t(y, s) {
      if (l) {
        var m = y.deletions;
        m === null ? ((y.deletions = [s]), (y.flags |= 16)) : m.push(s);
      }
    }
    function e(y, s) {
      if (!l) return null;
      for (; s !== null; ) (t(y, s), (s = s.sibling));
      return null;
    }
    function a(y) {
      for (var s = new Map(); y !== null; )
        (y.key !== null ? s.set(y.key, y) : s.set(y.index, y), (y = y.sibling));
      return s;
    }
    function u(y, s) {
      return ((y = Se(y, s)), (y.index = 0), (y.sibling = null), y);
    }
    function n(y, s, m) {
      return (
        (y.index = m),
        l
          ? ((m = y.alternate),
            m !== null
              ? ((m = m.index), m < s ? ((y.flags |= 67108866), s) : m)
              : ((y.flags |= 67108866), s))
          : ((y.flags |= 1048576), s)
      );
    }
    function i(y) {
      return (l && y.alternate === null && (y.flags |= 67108866), y);
    }
    function c(y, s, m, E) {
      return s === null || s.tag !== 6
        ? ((s = ec(m, y.mode, E)), (s.return = y), s)
        : ((s = u(s, m)), (s.return = y), s);
    }
    function o(y, s, m, E) {
      var J = m.type;
      return J === fl
        ? z(y, s, m.props.children, E, m.key)
        : s !== null &&
            (s.elementType === J ||
              (typeof J == "object" &&
                J !== null &&
                J.$$typeof === W &&
                za(J) === s.type))
          ? ((s = u(s, m.props)), Xu(s, m), (s.return = y), s)
          : ((s = jn(m.type, m.key, m.props, null, y.mode, E)),
            Xu(s, m),
            (s.return = y),
            s);
    }
    function g(y, s, m, E) {
      return s === null ||
        s.tag !== 4 ||
        s.stateNode.containerInfo !== m.containerInfo ||
        s.stateNode.implementation !== m.implementation
        ? ((s = ac(m, y.mode, E)), (s.return = y), s)
        : ((s = u(s, m.children || [])), (s.return = y), s);
    }
    function z(y, s, m, E, J) {
      return s === null || s.tag !== 7
        ? ((s = va(m, y.mode, E, J)), (s.return = y), s)
        : ((s = u(s, m)), (s.return = y), s);
    }
    function M(y, s, m) {
      if (
        (typeof s == "string" && s !== "") ||
        typeof s == "number" ||
        typeof s == "bigint"
      )
        return ((s = ec("" + s, y.mode, m)), (s.return = y), s);
      if (typeof s == "object" && s !== null) {
        switch (s.$$typeof) {
          case pl:
            return (
              (m = jn(s.type, s.key, s.props, null, y.mode, m)),
              Xu(m, s),
              (m.return = y),
              m
            );
          case V:
            return ((s = ac(s, y.mode, m)), (s.return = y), s);
          case W:
            return ((s = za(s)), M(y, s, m));
        }
        if (Dl(s) || Tl(s))
          return ((s = va(s, y.mode, m, null)), (s.return = y), s);
        if (typeof s.then == "function") return M(y, Xn(s), m);
        if (s.$$typeof === Cl) return M(y, Bn(y, s), m);
        Gn(y, s);
      }
      return null;
    }
    function v(y, s, m, E) {
      var J = s !== null ? s.key : null;
      if (
        (typeof m == "string" && m !== "") ||
        typeof m == "number" ||
        typeof m == "bigint"
      )
        return J !== null ? null : c(y, s, "" + m, E);
      if (typeof m == "object" && m !== null) {
        switch (m.$$typeof) {
          case pl:
            return m.key === J ? o(y, s, m, E) : null;
          case V:
            return m.key === J ? g(y, s, m, E) : null;
          case W:
            return ((m = za(m)), v(y, s, m, E));
        }
        if (Dl(m) || Tl(m)) return J !== null ? null : z(y, s, m, E, null);
        if (typeof m.then == "function") return v(y, s, Xn(m), E);
        if (m.$$typeof === Cl) return v(y, s, Bn(y, m), E);
        Gn(y, m);
      }
      return null;
    }
    function b(y, s, m, E, J) {
      if (
        (typeof E == "string" && E !== "") ||
        typeof E == "number" ||
        typeof E == "bigint"
      )
        return ((y = y.get(m) || null), c(s, y, "" + E, J));
      if (typeof E == "object" && E !== null) {
        switch (E.$$typeof) {
          case pl:
            return (
              (y = y.get(E.key === null ? m : E.key) || null),
              o(s, y, E, J)
            );
          case V:
            return (
              (y = y.get(E.key === null ? m : E.key) || null),
              g(s, y, E, J)
            );
          case W:
            return ((E = za(E)), b(y, s, m, E, J));
        }
        if (Dl(E) || Tl(E))
          return ((y = y.get(m) || null), z(s, y, E, J, null));
        if (typeof E.then == "function") return b(y, s, m, Xn(E), J);
        if (E.$$typeof === Cl) return b(y, s, m, Bn(s, E), J);
        Gn(s, E);
      }
      return null;
    }
    function X(y, s, m, E) {
      for (
        var J = null, ml = null, L = s, al = (s = 0), rl = null;
        L !== null && al < m.length;
        al++
      ) {
        L.index > al ? ((rl = L), (L = null)) : (rl = L.sibling);
        var gl = v(y, L, m[al], E);
        if (gl === null) {
          L === null && (L = rl);
          break;
        }
        (l && L && gl.alternate === null && t(y, L),
          (s = n(gl, s, al)),
          ml === null ? (J = gl) : (ml.sibling = gl),
          (ml = gl),
          (L = rl));
      }
      if (al === m.length) return (e(y, L), hl && be(y, al), J);
      if (L === null) {
        for (; al < m.length; al++)
          ((L = M(y, m[al], E)),
            L !== null &&
              ((s = n(L, s, al)),
              ml === null ? (J = L) : (ml.sibling = L),
              (ml = L)));
        return (hl && be(y, al), J);
      }
      for (L = a(L); al < m.length; al++)
        ((rl = b(L, y, al, m[al], E)),
          rl !== null &&
            (l &&
              rl.alternate !== null &&
              L.delete(rl.key === null ? al : rl.key),
            (s = n(rl, s, al)),
            ml === null ? (J = rl) : (ml.sibling = rl),
            (ml = rl)));
      return (
        l &&
          L.forEach(function (na) {
            return t(y, na);
          }),
        hl && be(y, al),
        J
      );
    }
    function w(y, s, m, E) {
      if (m == null) throw Error(h(151));
      for (
        var J = null, ml = null, L = s, al = (s = 0), rl = null, gl = m.next();
        L !== null && !gl.done;
        al++, gl = m.next()
      ) {
        L.index > al ? ((rl = L), (L = null)) : (rl = L.sibling);
        var na = v(y, L, gl.value, E);
        if (na === null) {
          L === null && (L = rl);
          break;
        }
        (l && L && na.alternate === null && t(y, L),
          (s = n(na, s, al)),
          ml === null ? (J = na) : (ml.sibling = na),
          (ml = na),
          (L = rl));
      }
      if (gl.done) return (e(y, L), hl && be(y, al), J);
      if (L === null) {
        for (; !gl.done; al++, gl = m.next())
          ((gl = M(y, gl.value, E)),
            gl !== null &&
              ((s = n(gl, s, al)),
              ml === null ? (J = gl) : (ml.sibling = gl),
              (ml = gl)));
        return (hl && be(y, al), J);
      }
      for (L = a(L); !gl.done; al++, gl = m.next())
        ((gl = b(L, y, al, gl.value, E)),
          gl !== null &&
            (l &&
              gl.alternate !== null &&
              L.delete(gl.key === null ? al : gl.key),
            (s = n(gl, s, al)),
            ml === null ? (J = gl) : (ml.sibling = gl),
            (ml = gl)));
      return (
        l &&
          L.forEach(function (Ph) {
            return t(y, Ph);
          }),
        hl && be(y, al),
        J
      );
    }
    function _l(y, s, m, E) {
      if (
        (typeof m == "object" &&
          m !== null &&
          m.type === fl &&
          m.key === null &&
          (m = m.props.children),
        typeof m == "object" && m !== null)
      ) {
        switch (m.$$typeof) {
          case pl:
            l: {
              for (var J = m.key; s !== null; ) {
                if (s.key === J) {
                  if (((J = m.type), J === fl)) {
                    if (s.tag === 7) {
                      (e(y, s.sibling),
                        (E = u(s, m.props.children)),
                        (E.return = y),
                        (y = E));
                      break l;
                    }
                  } else if (
                    s.elementType === J ||
                    (typeof J == "object" &&
                      J !== null &&
                      J.$$typeof === W &&
                      za(J) === s.type)
                  ) {
                    (e(y, s.sibling),
                      (E = u(s, m.props)),
                      Xu(E, m),
                      (E.return = y),
                      (y = E));
                    break l;
                  }
                  e(y, s);
                  break;
                } else t(y, s);
                s = s.sibling;
              }
              m.type === fl
                ? ((E = va(m.props.children, y.mode, E, m.key)),
                  (E.return = y),
                  (y = E))
                : ((E = jn(m.type, m.key, m.props, null, y.mode, E)),
                  Xu(E, m),
                  (E.return = y),
                  (y = E));
            }
            return i(y);
          case V:
            l: {
              for (J = m.key; s !== null; ) {
                if (s.key === J)
                  if (
                    s.tag === 4 &&
                    s.stateNode.containerInfo === m.containerInfo &&
                    s.stateNode.implementation === m.implementation
                  ) {
                    (e(y, s.sibling),
                      (E = u(s, m.children || [])),
                      (E.return = y),
                      (y = E));
                    break l;
                  } else {
                    e(y, s);
                    break;
                  }
                else t(y, s);
                s = s.sibling;
              }
              ((E = ac(m, y.mode, E)), (E.return = y), (y = E));
            }
            return i(y);
          case W:
            return ((m = za(m)), _l(y, s, m, E));
        }
        if (Dl(m)) return X(y, s, m, E);
        if (Tl(m)) {
          if (((J = Tl(m)), typeof J != "function")) throw Error(h(150));
          return ((m = J.call(m)), w(y, s, m, E));
        }
        if (typeof m.then == "function") return _l(y, s, Xn(m), E);
        if (m.$$typeof === Cl) return _l(y, s, Bn(y, m), E);
        Gn(y, m);
      }
      return (typeof m == "string" && m !== "") ||
        typeof m == "number" ||
        typeof m == "bigint"
        ? ((m = "" + m),
          s !== null && s.tag === 6
            ? (e(y, s.sibling), (E = u(s, m)), (E.return = y), (y = E))
            : (e(y, s), (E = ec(m, y.mode, E)), (E.return = y), (y = E)),
          i(y))
        : e(y, s);
    }
    return function (y, s, m, E) {
      try {
        qu = 0;
        var J = _l(y, s, m, E);
        return ((Fa = null), J);
      } catch (L) {
        if (L === $a || L === Yn) throw L;
        var ml = Ot(29, L, null, y.mode);
        return ((ml.lanes = E), (ml.return = y), ml);
      }
    };
  }
  var Aa = ko(!0),
    Wo = ko(!1),
    Le = !1;
  function mc(l) {
    l.updateQueue = {
      baseState: l.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null,
    };
  }
  function gc(l, t) {
    ((l = l.updateQueue),
      t.updateQueue === l &&
        (t.updateQueue = {
          baseState: l.baseState,
          firstBaseUpdate: l.firstBaseUpdate,
          lastBaseUpdate: l.lastBaseUpdate,
          shared: l.shared,
          callbacks: null,
        }));
  }
  function Ze(l) {
    return { lane: l, tag: 0, payload: null, callback: null, next: null };
  }
  function Ve(l, t, e) {
    var a = l.updateQueue;
    if (a === null) return null;
    if (((a = a.shared), (Sl & 2) !== 0)) {
      var u = a.pending;
      return (
        u === null ? (t.next = t) : ((t.next = u.next), (u.next = t)),
        (a.pending = t),
        (t = Un(l)),
        jo(l, null, e),
        t
      );
    }
    return (Rn(l, a, t, e), Un(l));
  }
  function Gu(l, t, e) {
    if (
      ((t = t.updateQueue), t !== null && ((t = t.shared), (e & 4194048) !== 0))
    ) {
      var a = t.lanes;
      ((a &= l.pendingLanes), (e |= a), (t.lanes = e), zu(l, e));
    }
  }
  function vc(l, t) {
    var e = l.updateQueue,
      a = l.alternate;
    if (a !== null && ((a = a.updateQueue), e === a)) {
      var u = null,
        n = null;
      if (((e = e.firstBaseUpdate), e !== null)) {
        do {
          var i = {
            lane: e.lane,
            tag: e.tag,
            payload: e.payload,
            callback: null,
            next: null,
          };
          (n === null ? (u = n = i) : (n = n.next = i), (e = e.next));
        } while (e !== null);
        n === null ? (u = n = t) : (n = n.next = t);
      } else u = n = t;
      ((e = {
        baseState: a.baseState,
        firstBaseUpdate: u,
        lastBaseUpdate: n,
        shared: a.shared,
        callbacks: a.callbacks,
      }),
        (l.updateQueue = e));
      return;
    }
    ((l = e.lastBaseUpdate),
      l === null ? (e.firstBaseUpdate = t) : (l.next = t),
      (e.lastBaseUpdate = t));
  }
  var Sc = !1;
  function Qu() {
    if (Sc) {
      var l = Wa;
      if (l !== null) throw l;
    }
  }
  function Lu(l, t, e, a) {
    Sc = !1;
    var u = l.updateQueue;
    Le = !1;
    var n = u.firstBaseUpdate,
      i = u.lastBaseUpdate,
      c = u.shared.pending;
    if (c !== null) {
      u.shared.pending = null;
      var o = c,
        g = o.next;
      ((o.next = null), i === null ? (n = g) : (i.next = g), (i = o));
      var z = l.alternate;
      z !== null &&
        ((z = z.updateQueue),
        (c = z.lastBaseUpdate),
        c !== i &&
          (c === null ? (z.firstBaseUpdate = g) : (c.next = g),
          (z.lastBaseUpdate = o)));
    }
    if (n !== null) {
      var M = u.baseState;
      ((i = 0), (z = g = o = null), (c = n));
      do {
        var v = c.lane & -536870913,
          b = v !== c.lane;
        if (b ? (sl & v) === v : (a & v) === v) {
          (v !== 0 && v === ka && (Sc = !0),
            z !== null &&
              (z = z.next =
                {
                  lane: 0,
                  tag: c.tag,
                  payload: c.payload,
                  callback: null,
                  next: null,
                }));
          l: {
            var X = l,
              w = c;
            v = t;
            var _l = e;
            switch (w.tag) {
              case 1:
                if (((X = w.payload), typeof X == "function")) {
                  M = X.call(_l, M, v);
                  break l;
                }
                M = X;
                break l;
              case 3:
                X.flags = (X.flags & -65537) | 128;
              case 0:
                if (
                  ((X = w.payload),
                  (v = typeof X == "function" ? X.call(_l, M, v) : X),
                  v == null)
                )
                  break l;
                M = j({}, M, v);
                break l;
              case 2:
                Le = !0;
            }
          }
          ((v = c.callback),
            v !== null &&
              ((l.flags |= 64),
              b && (l.flags |= 8192),
              (b = u.callbacks),
              b === null ? (u.callbacks = [v]) : b.push(v)));
        } else
          ((b = {
            lane: v,
            tag: c.tag,
            payload: c.payload,
            callback: c.callback,
            next: null,
          }),
            z === null ? ((g = z = b), (o = M)) : (z = z.next = b),
            (i |= v));
        if (((c = c.next), c === null)) {
          if (((c = u.shared.pending), c === null)) break;
          ((b = c),
            (c = b.next),
            (b.next = null),
            (u.lastBaseUpdate = b),
            (u.shared.pending = null));
        }
      } while (!0);
      (z === null && (o = M),
        (u.baseState = o),
        (u.firstBaseUpdate = g),
        (u.lastBaseUpdate = z),
        n === null && (u.shared.lanes = 0),
        (We |= i),
        (l.lanes = i),
        (l.memoizedState = M));
    }
  }
  function $o(l, t) {
    if (typeof l != "function") throw Error(h(191, l));
    l.call(t);
  }
  function Fo(l, t) {
    var e = l.callbacks;
    if (e !== null)
      for (l.callbacks = null, l = 0; l < e.length; l++) $o(e[l], t);
  }
  var Ia = r(null),
    Qn = r(0);
  function Io(l, t) {
    ((l = Re), C(Qn, l), C(Ia, t), (Re = l | t.baseLanes));
  }
  function bc() {
    (C(Qn, Re), C(Ia, Ia.current));
  }
  function pc() {
    ((Re = Qn.current), A(Ia), A(Qn));
  }
  var Dt = r(null),
    Vt = null;
  function Je(l) {
    var t = l.alternate;
    (C(Kl, Kl.current & 1),
      C(Dt, l),
      Vt === null &&
        (t === null || Ia.current !== null || t.memoizedState !== null) &&
        (Vt = l));
  }
  function Tc(l) {
    (C(Kl, Kl.current), C(Dt, l), Vt === null && (Vt = l));
  }
  function Po(l) {
    l.tag === 22
      ? (C(Kl, Kl.current), C(Dt, l), Vt === null && (Vt = l))
      : Ke();
  }
  function Ke() {
    (C(Kl, Kl.current), C(Dt, Dt.current));
  }
  function Rt(l) {
    (A(Dt), Vt === l && (Vt = null), A(Kl));
  }
  var Kl = r(0);
  function Ln(l) {
    for (var t = l; t !== null; ) {
      if (t.tag === 13) {
        var e = t.memoizedState;
        if (e !== null && ((e = e.dehydrated), e === null || Of(e) || Df(e)))
          return t;
      } else if (
        t.tag === 19 &&
        (t.memoizedProps.revealOrder === "forwards" ||
          t.memoizedProps.revealOrder === "backwards" ||
          t.memoizedProps.revealOrder === "unstable_legacy-backwards" ||
          t.memoizedProps.revealOrder === "together")
      ) {
        if ((t.flags & 128) !== 0) return t;
      } else if (t.child !== null) {
        ((t.child.return = t), (t = t.child));
        continue;
      }
      if (t === l) break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === l) return null;
        t = t.return;
      }
      ((t.sibling.return = t.return), (t = t.sibling));
    }
    return null;
  }
  var ze = 0,
    tl = null,
    Ml = null,
    $l = null,
    Zn = !1,
    Pa = !1,
    Ma = !1,
    Vn = 0,
    Zu = 0,
    lu = null,
    Zd = 0;
  function Ql() {
    throw Error(h(321));
  }
  function zc(l, t) {
    if (t === null) return !1;
    for (var e = 0; e < t.length && e < l.length; e++)
      if (!_t(l[e], t[e])) return !1;
    return !0;
  }
  function Ec(l, t, e, a, u, n) {
    return (
      (ze = n),
      (tl = t),
      (t.memoizedState = null),
      (t.updateQueue = null),
      (t.lanes = 0),
      (T.H = l === null || l.memoizedState === null ? Ns : qc),
      (Ma = !1),
      (n = e(a, u)),
      (Ma = !1),
      Pa && (n = ts(t, e, a, u)),
      ls(l),
      n
    );
  }
  function ls(l) {
    T.H = Ku;
    var t = Ml !== null && Ml.next !== null;
    if (((ze = 0), ($l = Ml = tl = null), (Zn = !1), (Zu = 0), (lu = null), t))
      throw Error(h(300));
    l === null ||
      Fl ||
      ((l = l.dependencies), l !== null && Hn(l) && (Fl = !0));
  }
  function ts(l, t, e, a) {
    tl = l;
    var u = 0;
    do {
      if ((Pa && (lu = null), (Zu = 0), (Pa = !1), 25 <= u))
        throw Error(h(301));
      if (((u += 1), ($l = Ml = null), l.updateQueue != null)) {
        var n = l.updateQueue;
        ((n.lastEffect = null),
          (n.events = null),
          (n.stores = null),
          n.memoCache != null && (n.memoCache.index = 0));
      }
      ((T.H = Ys), (n = t(e, a)));
    } while (Pa);
    return n;
  }
  function Vd() {
    var l = T.H,
      t = l.useState()[0];
    return (
      (t = typeof t.then == "function" ? Vu(t) : t),
      (l = l.useState()[0]),
      (Ml !== null ? Ml.memoizedState : null) !== l && (tl.flags |= 1024),
      t
    );
  }
  function Ac() {
    var l = Vn !== 0;
    return ((Vn = 0), l);
  }
  function Mc(l, t, e) {
    ((t.updateQueue = l.updateQueue), (t.flags &= -2053), (l.lanes &= ~e));
  }
  function xc(l) {
    if (Zn) {
      for (l = l.memoizedState; l !== null; ) {
        var t = l.queue;
        (t !== null && (t.pending = null), (l = l.next));
      }
      Zn = !1;
    }
    ((ze = 0), ($l = Ml = tl = null), (Pa = !1), (Zu = Vn = 0), (lu = null));
  }
  function gt() {
    var l = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null,
    };
    return ($l === null ? (tl.memoizedState = $l = l) : ($l = $l.next = l), $l);
  }
  function wl() {
    if (Ml === null) {
      var l = tl.alternate;
      l = l !== null ? l.memoizedState : null;
    } else l = Ml.next;
    var t = $l === null ? tl.memoizedState : $l.next;
    if (t !== null) (($l = t), (Ml = l));
    else {
      if (l === null)
        throw tl.alternate === null ? Error(h(467)) : Error(h(310));
      ((Ml = l),
        (l = {
          memoizedState: Ml.memoizedState,
          baseState: Ml.baseState,
          baseQueue: Ml.baseQueue,
          queue: Ml.queue,
          next: null,
        }),
        $l === null ? (tl.memoizedState = $l = l) : ($l = $l.next = l));
    }
    return $l;
  }
  function Jn() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function Vu(l) {
    var t = Zu;
    return (
      (Zu += 1),
      lu === null && (lu = []),
      (l = Jo(lu, l, t)),
      (t = tl),
      ($l === null ? t.memoizedState : $l.next) === null &&
        ((t = t.alternate),
        (T.H = t === null || t.memoizedState === null ? Ns : qc)),
      l
    );
  }
  function Kn(l) {
    if (l !== null && typeof l == "object") {
      if (typeof l.then == "function") return Vu(l);
      if (l.$$typeof === Cl) return st(l);
    }
    throw Error(h(438, String(l)));
  }
  function _c(l) {
    var t = null,
      e = tl.updateQueue;
    if ((e !== null && (t = e.memoCache), t == null)) {
      var a = tl.alternate;
      a !== null &&
        ((a = a.updateQueue),
        a !== null &&
          ((a = a.memoCache),
          a != null &&
            (t = {
              data: a.data.map(function (u) {
                return u.slice();
              }),
              index: 0,
            })));
    }
    if (
      (t == null && (t = { data: [], index: 0 }),
      e === null && ((e = Jn()), (tl.updateQueue = e)),
      (e.memoCache = t),
      (e = t.data[t.index]),
      e === void 0)
    )
      for (e = t.data[t.index] = Array(l), a = 0; a < l; a++) e[a] = it;
    return (t.index++, e);
  }
  function Ee(l, t) {
    return typeof t == "function" ? t(l) : t;
  }
  function wn(l) {
    var t = wl();
    return Oc(t, Ml, l);
  }
  function Oc(l, t, e) {
    var a = l.queue;
    if (a === null) throw Error(h(311));
    a.lastRenderedReducer = e;
    var u = l.baseQueue,
      n = a.pending;
    if (n !== null) {
      if (u !== null) {
        var i = u.next;
        ((u.next = n.next), (n.next = i));
      }
      ((t.baseQueue = u = n), (a.pending = null));
    }
    if (((n = l.baseState), u === null)) l.memoizedState = n;
    else {
      t = u.next;
      var c = (i = null),
        o = null,
        g = t,
        z = !1;
      do {
        var M = g.lane & -536870913;
        if (M !== g.lane ? (sl & M) === M : (ze & M) === M) {
          var v = g.revertLane;
          if (v === 0)
            (o !== null &&
              (o = o.next =
                {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: g.action,
                  hasEagerState: g.hasEagerState,
                  eagerState: g.eagerState,
                  next: null,
                }),
              M === ka && (z = !0));
          else if ((ze & v) === v) {
            ((g = g.next), v === ka && (z = !0));
            continue;
          } else
            ((M = {
              lane: 0,
              revertLane: g.revertLane,
              gesture: null,
              action: g.action,
              hasEagerState: g.hasEagerState,
              eagerState: g.eagerState,
              next: null,
            }),
              o === null ? ((c = o = M), (i = n)) : (o = o.next = M),
              (tl.lanes |= v),
              (We |= v));
          ((M = g.action),
            Ma && e(n, M),
            (n = g.hasEagerState ? g.eagerState : e(n, M)));
        } else
          ((v = {
            lane: M,
            revertLane: g.revertLane,
            gesture: g.gesture,
            action: g.action,
            hasEagerState: g.hasEagerState,
            eagerState: g.eagerState,
            next: null,
          }),
            o === null ? ((c = o = v), (i = n)) : (o = o.next = v),
            (tl.lanes |= M),
            (We |= M));
        g = g.next;
      } while (g !== null && g !== t);
      if (
        (o === null ? (i = n) : (o.next = c),
        !_t(n, l.memoizedState) && ((Fl = !0), z && ((e = Wa), e !== null)))
      )
        throw e;
      ((l.memoizedState = n),
        (l.baseState = i),
        (l.baseQueue = o),
        (a.lastRenderedState = n));
    }
    return (u === null && (a.lanes = 0), [l.memoizedState, a.dispatch]);
  }
  function Dc(l) {
    var t = wl(),
      e = t.queue;
    if (e === null) throw Error(h(311));
    e.lastRenderedReducer = l;
    var a = e.dispatch,
      u = e.pending,
      n = t.memoizedState;
    if (u !== null) {
      e.pending = null;
      var i = (u = u.next);
      do ((n = l(n, i.action)), (i = i.next));
      while (i !== u);
      (_t(n, t.memoizedState) || (Fl = !0),
        (t.memoizedState = n),
        t.baseQueue === null && (t.baseState = n),
        (e.lastRenderedState = n));
    }
    return [n, a];
  }
  function es(l, t, e) {
    var a = tl,
      u = wl(),
      n = hl;
    if (n) {
      if (e === void 0) throw Error(h(407));
      e = e();
    } else e = t();
    var i = !_t((Ml || u).memoizedState, e);
    if (
      (i && ((u.memoizedState = e), (Fl = !0)),
      (u = u.queue),
      jc(ns.bind(null, a, u, l), [l]),
      u.getSnapshot !== t || i || ($l !== null && $l.memoizedState.tag & 1))
    ) {
      if (
        ((a.flags |= 2048),
        tu(9, { destroy: void 0 }, us.bind(null, a, u, e, t), null),
        jl === null)
      )
        throw Error(h(349));
      n || (ze & 127) !== 0 || as(a, t, e);
    }
    return e;
  }
  function as(l, t, e) {
    ((l.flags |= 16384),
      (l = { getSnapshot: t, value: e }),
      (t = tl.updateQueue),
      t === null
        ? ((t = Jn()), (tl.updateQueue = t), (t.stores = [l]))
        : ((e = t.stores), e === null ? (t.stores = [l]) : e.push(l)));
  }
  function us(l, t, e, a) {
    ((t.value = e), (t.getSnapshot = a), is(t) && cs(l));
  }
  function ns(l, t, e) {
    return e(function () {
      is(t) && cs(l);
    });
  }
  function is(l) {
    var t = l.getSnapshot;
    l = l.value;
    try {
      var e = t();
      return !_t(l, e);
    } catch {
      return !0;
    }
  }
  function cs(l) {
    var t = ga(l, 2);
    t !== null && Mt(t, l, 2);
  }
  function Rc(l) {
    var t = gt();
    if (typeof l == "function") {
      var e = l;
      if (((l = e()), Ma)) {
        Gl(!0);
        try {
          e();
        } finally {
          Gl(!1);
        }
      }
    }
    return (
      (t.memoizedState = t.baseState = l),
      (t.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Ee,
        lastRenderedState: l,
      }),
      t
    );
  }
  function fs(l, t, e, a) {
    return ((l.baseState = e), Oc(l, Ml, typeof a == "function" ? a : Ee));
  }
  function Jd(l, t, e, a, u) {
    if ($n(l)) throw Error(h(485));
    if (((l = t.action), l !== null)) {
      var n = {
        payload: u,
        action: l,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function (i) {
          n.listeners.push(i);
        },
      };
      (T.T !== null ? e(!0) : (n.isTransition = !1),
        a(n),
        (e = t.pending),
        e === null
          ? ((n.next = t.pending = n), os(t, n))
          : ((n.next = e.next), (t.pending = e.next = n)));
    }
  }
  function os(l, t) {
    var e = t.action,
      a = t.payload,
      u = l.state;
    if (t.isTransition) {
      var n = T.T,
        i = {};
      T.T = i;
      try {
        var c = e(u, a),
          o = T.S;
        (o !== null && o(i, c), ss(l, t, c));
      } catch (g) {
        Uc(l, t, g);
      } finally {
        (n !== null && i.types !== null && (n.types = i.types), (T.T = n));
      }
    } else
      try {
        ((n = e(u, a)), ss(l, t, n));
      } catch (g) {
        Uc(l, t, g);
      }
  }
  function ss(l, t, e) {
    e !== null && typeof e == "object" && typeof e.then == "function"
      ? e.then(
          function (a) {
            rs(l, t, a);
          },
          function (a) {
            return Uc(l, t, a);
          },
        )
      : rs(l, t, e);
  }
  function rs(l, t, e) {
    ((t.status = "fulfilled"),
      (t.value = e),
      ds(t),
      (l.state = e),
      (t = l.pending),
      t !== null &&
        ((e = t.next),
        e === t ? (l.pending = null) : ((e = e.next), (t.next = e), os(l, e))));
  }
  function Uc(l, t, e) {
    var a = l.pending;
    if (((l.pending = null), a !== null)) {
      a = a.next;
      do ((t.status = "rejected"), (t.reason = e), ds(t), (t = t.next));
      while (t !== a);
    }
    l.action = null;
  }
  function ds(l) {
    l = l.listeners;
    for (var t = 0; t < l.length; t++) (0, l[t])();
  }
  function hs(l, t) {
    return t;
  }
  function ys(l, t) {
    if (hl) {
      var e = jl.formState;
      if (e !== null) {
        l: {
          var a = tl;
          if (hl) {
            if (Nl) {
              t: {
                for (var u = Nl, n = Zt; u.nodeType !== 8; ) {
                  if (!n) {
                    u = null;
                    break t;
                  }
                  if (((u = Jt(u.nextSibling)), u === null)) {
                    u = null;
                    break t;
                  }
                }
                ((n = u.data), (u = n === "F!" || n === "F" ? u : null));
              }
              if (u) {
                ((Nl = Jt(u.nextSibling)), (a = u.data === "F!"));
                break l;
              }
            }
            Ge(a);
          }
          a = !1;
        }
        a && (t = e[0]);
      }
    }
    return (
      (e = gt()),
      (e.memoizedState = e.baseState = t),
      (a = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: hs,
        lastRenderedState: t,
      }),
      (e.queue = a),
      (e = Cs.bind(null, tl, a)),
      (a.dispatch = e),
      (a = Rc(!1)),
      (n = Yc.bind(null, tl, !1, a.queue)),
      (a = gt()),
      (u = { state: t, dispatch: null, action: l, pending: null }),
      (a.queue = u),
      (e = Jd.bind(null, tl, u, n, e)),
      (u.dispatch = e),
      (a.memoizedState = l),
      [t, e, !1]
    );
  }
  function ms(l) {
    var t = wl();
    return gs(t, Ml, l);
  }
  function gs(l, t, e) {
    if (
      ((t = Oc(l, t, hs)[0]),
      (l = wn(Ee)[0]),
      typeof t == "object" && t !== null && typeof t.then == "function")
    )
      try {
        var a = Vu(t);
      } catch (i) {
        throw i === $a ? Yn : i;
      }
    else a = t;
    t = wl();
    var u = t.queue,
      n = u.dispatch;
    return (
      e !== t.memoizedState &&
        ((tl.flags |= 2048),
        tu(9, { destroy: void 0 }, Kd.bind(null, u, e), null)),
      [a, n, l]
    );
  }
  function Kd(l, t) {
    l.action = t;
  }
  function vs(l) {
    var t = wl(),
      e = Ml;
    if (e !== null) return gs(t, e, l);
    (wl(), (t = t.memoizedState), (e = wl()));
    var a = e.queue.dispatch;
    return ((e.memoizedState = l), [t, a, !1]);
  }
  function tu(l, t, e, a) {
    return (
      (l = { tag: l, create: e, deps: a, inst: t, next: null }),
      (t = tl.updateQueue),
      t === null && ((t = Jn()), (tl.updateQueue = t)),
      (e = t.lastEffect),
      e === null
        ? (t.lastEffect = l.next = l)
        : ((a = e.next), (e.next = l), (l.next = a), (t.lastEffect = l)),
      l
    );
  }
  function Ss() {
    return wl().memoizedState;
  }
  function kn(l, t, e, a) {
    var u = gt();
    ((tl.flags |= l),
      (u.memoizedState = tu(
        1 | t,
        { destroy: void 0 },
        e,
        a === void 0 ? null : a,
      )));
  }
  function Wn(l, t, e, a) {
    var u = wl();
    a = a === void 0 ? null : a;
    var n = u.memoizedState.inst;
    Ml !== null && a !== null && zc(a, Ml.memoizedState.deps)
      ? (u.memoizedState = tu(t, n, e, a))
      : ((tl.flags |= l), (u.memoizedState = tu(1 | t, n, e, a)));
  }
  function bs(l, t) {
    kn(8390656, 8, l, t);
  }
  function jc(l, t) {
    Wn(2048, 8, l, t);
  }
  function wd(l) {
    tl.flags |= 4;
    var t = tl.updateQueue;
    if (t === null) ((t = Jn()), (tl.updateQueue = t), (t.events = [l]));
    else {
      var e = t.events;
      e === null ? (t.events = [l]) : e.push(l);
    }
  }
  function ps(l) {
    var t = wl().memoizedState;
    return (
      wd({ ref: t, nextImpl: l }),
      function () {
        if ((Sl & 2) !== 0) throw Error(h(440));
        return t.impl.apply(void 0, arguments);
      }
    );
  }
  function Ts(l, t) {
    return Wn(4, 2, l, t);
  }
  function zs(l, t) {
    return Wn(4, 4, l, t);
  }
  function Es(l, t) {
    if (typeof t == "function") {
      l = l();
      var e = t(l);
      return function () {
        typeof e == "function" ? e() : t(null);
      };
    }
    if (t != null)
      return (
        (l = l()),
        (t.current = l),
        function () {
          t.current = null;
        }
      );
  }
  function As(l, t, e) {
    ((e = e != null ? e.concat([l]) : null), Wn(4, 4, Es.bind(null, t, l), e));
  }
  function Cc() {}
  function Ms(l, t) {
    var e = wl();
    t = t === void 0 ? null : t;
    var a = e.memoizedState;
    return t !== null && zc(t, a[1]) ? a[0] : ((e.memoizedState = [l, t]), l);
  }
  function xs(l, t) {
    var e = wl();
    t = t === void 0 ? null : t;
    var a = e.memoizedState;
    if (t !== null && zc(t, a[1])) return a[0];
    if (((a = l()), Ma)) {
      Gl(!0);
      try {
        l();
      } finally {
        Gl(!1);
      }
    }
    return ((e.memoizedState = [a, t]), a);
  }
  function Hc(l, t, e) {
    return e === void 0 || ((ze & 1073741824) !== 0 && (sl & 261930) === 0)
      ? (l.memoizedState = t)
      : ((l.memoizedState = e), (l = _0()), (tl.lanes |= l), (We |= l), e);
  }
  function _s(l, t, e, a) {
    return _t(e, t)
      ? e
      : Ia.current !== null
        ? ((l = Hc(l, e, a)), _t(l, t) || (Fl = !0), l)
        : (ze & 42) === 0 || ((ze & 1073741824) !== 0 && (sl & 261930) === 0)
          ? ((Fl = !0), (l.memoizedState = e))
          : ((l = _0()), (tl.lanes |= l), (We |= l), t);
  }
  function Os(l, t, e, a, u) {
    var n = D.p;
    D.p = n !== 0 && 8 > n ? n : 8;
    var i = T.T,
      c = {};
    ((T.T = c), Yc(l, !1, t, e));
    try {
      var o = u(),
        g = T.S;
      if (
        (g !== null && g(c, o),
        o !== null && typeof o == "object" && typeof o.then == "function")
      ) {
        var z = Ld(o, a);
        Ju(l, t, z, Ct(l));
      } else Ju(l, t, a, Ct(l));
    } catch (M) {
      Ju(l, t, { then: function () {}, status: "rejected", reason: M }, Ct());
    } finally {
      ((D.p = n),
        i !== null && c.types !== null && (i.types = c.types),
        (T.T = i));
    }
  }
  function kd() {}
  function Bc(l, t, e, a) {
    if (l.tag !== 5) throw Error(h(476));
    var u = Ds(l).queue;
    Os(
      l,
      u,
      t,
      K,
      e === null
        ? kd
        : function () {
            return (Rs(l), e(a));
          },
    );
  }
  function Ds(l) {
    var t = l.memoizedState;
    if (t !== null) return t;
    t = {
      memoizedState: K,
      baseState: K,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Ee,
        lastRenderedState: K,
      },
      next: null,
    };
    var e = {};
    return (
      (t.next = {
        memoizedState: e,
        baseState: e,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ee,
          lastRenderedState: e,
        },
        next: null,
      }),
      (l.memoizedState = t),
      (l = l.alternate),
      l !== null && (l.memoizedState = t),
      t
    );
  }
  function Rs(l) {
    var t = Ds(l);
    (t.next === null && (t = l.alternate.memoizedState),
      Ju(l, t.next.queue, {}, Ct()));
  }
  function Nc() {
    return st(on);
  }
  function Us() {
    return wl().memoizedState;
  }
  function js() {
    return wl().memoizedState;
  }
  function Wd(l) {
    for (var t = l.return; t !== null; ) {
      switch (t.tag) {
        case 24:
        case 3:
          var e = Ct();
          l = Ze(e);
          var a = Ve(t, l, e);
          (a !== null && (Mt(a, t, e), Gu(a, t, e)),
            (t = { cache: rc() }),
            (l.payload = t));
          return;
      }
      t = t.return;
    }
  }
  function $d(l, t, e) {
    var a = Ct();
    ((e = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: e,
      hasEagerState: !1,
      eagerState: null,
      next: null,
    }),
      $n(l)
        ? Hs(t, e)
        : ((e = lc(l, t, e, a)), e !== null && (Mt(e, l, a), Bs(e, t, a))));
  }
  function Cs(l, t, e) {
    var a = Ct();
    Ju(l, t, e, a);
  }
  function Ju(l, t, e, a) {
    var u = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: e,
      hasEagerState: !1,
      eagerState: null,
      next: null,
    };
    if ($n(l)) Hs(t, u);
    else {
      var n = l.alternate;
      if (
        l.lanes === 0 &&
        (n === null || n.lanes === 0) &&
        ((n = t.lastRenderedReducer), n !== null)
      )
        try {
          var i = t.lastRenderedState,
            c = n(i, e);
          if (((u.hasEagerState = !0), (u.eagerState = c), _t(c, i)))
            return (Rn(l, t, u, 0), jl === null && Dn(), !1);
        } catch {}
      if (((e = lc(l, t, u, a)), e !== null))
        return (Mt(e, l, a), Bs(e, t, a), !0);
    }
    return !1;
  }
  function Yc(l, t, e, a) {
    if (
      ((a = {
        lane: 2,
        revertLane: gf(),
        gesture: null,
        action: a,
        hasEagerState: !1,
        eagerState: null,
        next: null,
      }),
      $n(l))
    ) {
      if (t) throw Error(h(479));
    } else ((t = lc(l, e, a, 2)), t !== null && Mt(t, l, 2));
  }
  function $n(l) {
    var t = l.alternate;
    return l === tl || (t !== null && t === tl);
  }
  function Hs(l, t) {
    Pa = Zn = !0;
    var e = l.pending;
    (e === null ? (t.next = t) : ((t.next = e.next), (e.next = t)),
      (l.pending = t));
  }
  function Bs(l, t, e) {
    if ((e & 4194048) !== 0) {
      var a = t.lanes;
      ((a &= l.pendingLanes), (e |= a), (t.lanes = e), zu(l, e));
    }
  }
  var Ku = {
    readContext: st,
    use: Kn,
    useCallback: Ql,
    useContext: Ql,
    useEffect: Ql,
    useImperativeHandle: Ql,
    useLayoutEffect: Ql,
    useInsertionEffect: Ql,
    useMemo: Ql,
    useReducer: Ql,
    useRef: Ql,
    useState: Ql,
    useDebugValue: Ql,
    useDeferredValue: Ql,
    useTransition: Ql,
    useSyncExternalStore: Ql,
    useId: Ql,
    useHostTransitionStatus: Ql,
    useFormState: Ql,
    useActionState: Ql,
    useOptimistic: Ql,
    useMemoCache: Ql,
    useCacheRefresh: Ql,
  };
  Ku.useEffectEvent = Ql;
  var Ns = {
      readContext: st,
      use: Kn,
      useCallback: function (l, t) {
        return ((gt().memoizedState = [l, t === void 0 ? null : t]), l);
      },
      useContext: st,
      useEffect: bs,
      useImperativeHandle: function (l, t, e) {
        ((e = e != null ? e.concat([l]) : null),
          kn(4194308, 4, Es.bind(null, t, l), e));
      },
      useLayoutEffect: function (l, t) {
        return kn(4194308, 4, l, t);
      },
      useInsertionEffect: function (l, t) {
        kn(4, 2, l, t);
      },
      useMemo: function (l, t) {
        var e = gt();
        t = t === void 0 ? null : t;
        var a = l();
        if (Ma) {
          Gl(!0);
          try {
            l();
          } finally {
            Gl(!1);
          }
        }
        return ((e.memoizedState = [a, t]), a);
      },
      useReducer: function (l, t, e) {
        var a = gt();
        if (e !== void 0) {
          var u = e(t);
          if (Ma) {
            Gl(!0);
            try {
              e(t);
            } finally {
              Gl(!1);
            }
          }
        } else u = t;
        return (
          (a.memoizedState = a.baseState = u),
          (l = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: l,
            lastRenderedState: u,
          }),
          (a.queue = l),
          (l = l.dispatch = $d.bind(null, tl, l)),
          [a.memoizedState, l]
        );
      },
      useRef: function (l) {
        var t = gt();
        return ((l = { current: l }), (t.memoizedState = l));
      },
      useState: function (l) {
        l = Rc(l);
        var t = l.queue,
          e = Cs.bind(null, tl, t);
        return ((t.dispatch = e), [l.memoizedState, e]);
      },
      useDebugValue: Cc,
      useDeferredValue: function (l, t) {
        var e = gt();
        return Hc(e, l, t);
      },
      useTransition: function () {
        var l = Rc(!1);
        return (
          (l = Os.bind(null, tl, l.queue, !0, !1)),
          (gt().memoizedState = l),
          [!1, l]
        );
      },
      useSyncExternalStore: function (l, t, e) {
        var a = tl,
          u = gt();
        if (hl) {
          if (e === void 0) throw Error(h(407));
          e = e();
        } else {
          if (((e = t()), jl === null)) throw Error(h(349));
          (sl & 127) !== 0 || as(a, t, e);
        }
        u.memoizedState = e;
        var n = { value: e, getSnapshot: t };
        return (
          (u.queue = n),
          bs(ns.bind(null, a, n, l), [l]),
          (a.flags |= 2048),
          tu(9, { destroy: void 0 }, us.bind(null, a, n, e, t), null),
          e
        );
      },
      useId: function () {
        var l = gt(),
          t = jl.identifierPrefix;
        if (hl) {
          var e = fe,
            a = ce;
          ((e = (a & ~(1 << (32 - mt(a) - 1))).toString(32) + e),
            (t = "_" + t + "R_" + e),
            (e = Vn++),
            0 < e && (t += "H" + e.toString(32)),
            (t += "_"));
        } else ((e = Zd++), (t = "_" + t + "r_" + e.toString(32) + "_"));
        return (l.memoizedState = t);
      },
      useHostTransitionStatus: Nc,
      useFormState: ys,
      useActionState: ys,
      useOptimistic: function (l) {
        var t = gt();
        t.memoizedState = t.baseState = l;
        var e = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null,
        };
        return (
          (t.queue = e),
          (t = Yc.bind(null, tl, !0, e)),
          (e.dispatch = t),
          [l, t]
        );
      },
      useMemoCache: _c,
      useCacheRefresh: function () {
        return (gt().memoizedState = Wd.bind(null, tl));
      },
      useEffectEvent: function (l) {
        var t = gt(),
          e = { impl: l };
        return (
          (t.memoizedState = e),
          function () {
            if ((Sl & 2) !== 0) throw Error(h(440));
            return e.impl.apply(void 0, arguments);
          }
        );
      },
    },
    qc = {
      readContext: st,
      use: Kn,
      useCallback: Ms,
      useContext: st,
      useEffect: jc,
      useImperativeHandle: As,
      useInsertionEffect: Ts,
      useLayoutEffect: zs,
      useMemo: xs,
      useReducer: wn,
      useRef: Ss,
      useState: function () {
        return wn(Ee);
      },
      useDebugValue: Cc,
      useDeferredValue: function (l, t) {
        var e = wl();
        return _s(e, Ml.memoizedState, l, t);
      },
      useTransition: function () {
        var l = wn(Ee)[0],
          t = wl().memoizedState;
        return [typeof l == "boolean" ? l : Vu(l), t];
      },
      useSyncExternalStore: es,
      useId: Us,
      useHostTransitionStatus: Nc,
      useFormState: ms,
      useActionState: ms,
      useOptimistic: function (l, t) {
        var e = wl();
        return fs(e, Ml, l, t);
      },
      useMemoCache: _c,
      useCacheRefresh: js,
    };
  qc.useEffectEvent = ps;
  var Ys = {
    readContext: st,
    use: Kn,
    useCallback: Ms,
    useContext: st,
    useEffect: jc,
    useImperativeHandle: As,
    useInsertionEffect: Ts,
    useLayoutEffect: zs,
    useMemo: xs,
    useReducer: Dc,
    useRef: Ss,
    useState: function () {
      return Dc(Ee);
    },
    useDebugValue: Cc,
    useDeferredValue: function (l, t) {
      var e = wl();
      return Ml === null ? Hc(e, l, t) : _s(e, Ml.memoizedState, l, t);
    },
    useTransition: function () {
      var l = Dc(Ee)[0],
        t = wl().memoizedState;
      return [typeof l == "boolean" ? l : Vu(l), t];
    },
    useSyncExternalStore: es,
    useId: Us,
    useHostTransitionStatus: Nc,
    useFormState: vs,
    useActionState: vs,
    useOptimistic: function (l, t) {
      var e = wl();
      return Ml !== null
        ? fs(e, Ml, l, t)
        : ((e.baseState = l), [l, e.queue.dispatch]);
    },
    useMemoCache: _c,
    useCacheRefresh: js,
  };
  Ys.useEffectEvent = ps;
  function Xc(l, t, e, a) {
    ((t = l.memoizedState),
      (e = e(a, t)),
      (e = e == null ? t : j({}, t, e)),
      (l.memoizedState = e),
      l.lanes === 0 && (l.updateQueue.baseState = e));
  }
  var Gc = {
    enqueueSetState: function (l, t, e) {
      l = l._reactInternals;
      var a = Ct(),
        u = Ze(a);
      ((u.payload = t),
        e != null && (u.callback = e),
        (t = Ve(l, u, a)),
        t !== null && (Mt(t, l, a), Gu(t, l, a)));
    },
    enqueueReplaceState: function (l, t, e) {
      l = l._reactInternals;
      var a = Ct(),
        u = Ze(a);
      ((u.tag = 1),
        (u.payload = t),
        e != null && (u.callback = e),
        (t = Ve(l, u, a)),
        t !== null && (Mt(t, l, a), Gu(t, l, a)));
    },
    enqueueForceUpdate: function (l, t) {
      l = l._reactInternals;
      var e = Ct(),
        a = Ze(e);
      ((a.tag = 2),
        t != null && (a.callback = t),
        (t = Ve(l, a, e)),
        t !== null && (Mt(t, l, e), Gu(t, l, e)));
    },
  };
  function qs(l, t, e, a, u, n, i) {
    return (
      (l = l.stateNode),
      typeof l.shouldComponentUpdate == "function"
        ? l.shouldComponentUpdate(a, n, i)
        : t.prototype && t.prototype.isPureReactComponent
          ? !ju(e, a) || !ju(u, n)
          : !0
    );
  }
  function Xs(l, t, e, a) {
    ((l = t.state),
      typeof t.componentWillReceiveProps == "function" &&
        t.componentWillReceiveProps(e, a),
      typeof t.UNSAFE_componentWillReceiveProps == "function" &&
        t.UNSAFE_componentWillReceiveProps(e, a),
      t.state !== l && Gc.enqueueReplaceState(t, t.state, null));
  }
  function xa(l, t) {
    var e = t;
    if ("ref" in t) {
      e = {};
      for (var a in t) a !== "ref" && (e[a] = t[a]);
    }
    if ((l = l.defaultProps)) {
      e === t && (e = j({}, e));
      for (var u in l) e[u] === void 0 && (e[u] = l[u]);
    }
    return e;
  }
  function Gs(l) {
    On(l);
  }
  function Qs(l) {
    console.error(l);
  }
  function Ls(l) {
    On(l);
  }
  function Fn(l, t) {
    try {
      var e = l.onUncaughtError;
      e(t.value, { componentStack: t.stack });
    } catch (a) {
      setTimeout(function () {
        throw a;
      });
    }
  }
  function Zs(l, t, e) {
    try {
      var a = l.onCaughtError;
      a(e.value, {
        componentStack: e.stack,
        errorBoundary: t.tag === 1 ? t.stateNode : null,
      });
    } catch (u) {
      setTimeout(function () {
        throw u;
      });
    }
  }
  function Qc(l, t, e) {
    return (
      (e = Ze(e)),
      (e.tag = 3),
      (e.payload = { element: null }),
      (e.callback = function () {
        Fn(l, t);
      }),
      e
    );
  }
  function Vs(l) {
    return ((l = Ze(l)), (l.tag = 3), l);
  }
  function Js(l, t, e, a) {
    var u = e.type.getDerivedStateFromError;
    if (typeof u == "function") {
      var n = a.value;
      ((l.payload = function () {
        return u(n);
      }),
        (l.callback = function () {
          Zs(t, e, a);
        }));
    }
    var i = e.stateNode;
    i !== null &&
      typeof i.componentDidCatch == "function" &&
      (l.callback = function () {
        (Zs(t, e, a),
          typeof u != "function" &&
            ($e === null ? ($e = new Set([this])) : $e.add(this)));
        var c = a.stack;
        this.componentDidCatch(a.value, {
          componentStack: c !== null ? c : "",
        });
      });
  }
  function Fd(l, t, e, a, u) {
    if (
      ((e.flags |= 32768),
      a !== null && typeof a == "object" && typeof a.then == "function")
    ) {
      if (
        ((t = e.alternate),
        t !== null && wa(t, e, u, !0),
        (e = Dt.current),
        e !== null)
      ) {
        switch (e.tag) {
          case 31:
          case 13:
            return (
              Vt === null ? oi() : e.alternate === null && Ll === 0 && (Ll = 3),
              (e.flags &= -257),
              (e.flags |= 65536),
              (e.lanes = u),
              a === qn
                ? (e.flags |= 16384)
                : ((t = e.updateQueue),
                  t === null ? (e.updateQueue = new Set([a])) : t.add(a),
                  hf(l, a, u)),
              !1
            );
          case 22:
            return (
              (e.flags |= 65536),
              a === qn
                ? (e.flags |= 16384)
                : ((t = e.updateQueue),
                  t === null
                    ? ((t = {
                        transitions: null,
                        markerInstances: null,
                        retryQueue: new Set([a]),
                      }),
                      (e.updateQueue = t))
                    : ((e = t.retryQueue),
                      e === null ? (t.retryQueue = new Set([a])) : e.add(a)),
                  hf(l, a, u)),
              !1
            );
        }
        throw Error(h(435, e.tag));
      }
      return (hf(l, a, u), oi(), !1);
    }
    if (hl)
      return (
        (t = Dt.current),
        t !== null
          ? ((t.flags & 65536) === 0 && (t.flags |= 256),
            (t.flags |= 65536),
            (t.lanes = u),
            a !== ic && ((l = Error(h(422), { cause: a })), Bu(Gt(l, e))))
          : (a !== ic && ((t = Error(h(423), { cause: a })), Bu(Gt(t, e))),
            (l = l.current.alternate),
            (l.flags |= 65536),
            (u &= -u),
            (l.lanes |= u),
            (a = Gt(a, e)),
            (u = Qc(l.stateNode, a, u)),
            vc(l, u),
            Ll !== 4 && (Ll = 2)),
        !1
      );
    var n = Error(h(520), { cause: a });
    if (
      ((n = Gt(n, e)),
      ln === null ? (ln = [n]) : ln.push(n),
      Ll !== 4 && (Ll = 2),
      t === null)
    )
      return !0;
    ((a = Gt(a, e)), (e = t));
    do {
      switch (e.tag) {
        case 3:
          return (
            (e.flags |= 65536),
            (l = u & -u),
            (e.lanes |= l),
            (l = Qc(e.stateNode, a, l)),
            vc(e, l),
            !1
          );
        case 1:
          if (
            ((t = e.type),
            (n = e.stateNode),
            (e.flags & 128) === 0 &&
              (typeof t.getDerivedStateFromError == "function" ||
                (n !== null &&
                  typeof n.componentDidCatch == "function" &&
                  ($e === null || !$e.has(n)))))
          )
            return (
              (e.flags |= 65536),
              (u &= -u),
              (e.lanes |= u),
              (u = Vs(u)),
              Js(u, l, e, a),
              vc(e, u),
              !1
            );
      }
      e = e.return;
    } while (e !== null);
    return !1;
  }
  var Lc = Error(h(461)),
    Fl = !1;
  function rt(l, t, e, a) {
    t.child = l === null ? Wo(t, null, e, a) : Aa(t, l.child, e, a);
  }
  function Ks(l, t, e, a, u) {
    e = e.render;
    var n = t.ref;
    if ("ref" in a) {
      var i = {};
      for (var c in a) c !== "ref" && (i[c] = a[c]);
    } else i = a;
    return (
      pa(t),
      (a = Ec(l, t, e, i, n, u)),
      (c = Ac()),
      l !== null && !Fl
        ? (Mc(l, t, u), Ae(l, t, u))
        : (hl && c && uc(t), (t.flags |= 1), rt(l, t, a, u), t.child)
    );
  }
  function ws(l, t, e, a, u) {
    if (l === null) {
      var n = e.type;
      return typeof n == "function" &&
        !tc(n) &&
        n.defaultProps === void 0 &&
        e.compare === null
        ? ((t.tag = 15), (t.type = n), ks(l, t, n, a, u))
        : ((l = jn(e.type, null, a, t, t.mode, u)),
          (l.ref = t.ref),
          (l.return = t),
          (t.child = l));
    }
    if (((n = l.child), !$c(l, u))) {
      var i = n.memoizedProps;
      if (
        ((e = e.compare), (e = e !== null ? e : ju), e(i, a) && l.ref === t.ref)
      )
        return Ae(l, t, u);
    }
    return (
      (t.flags |= 1),
      (l = Se(n, a)),
      (l.ref = t.ref),
      (l.return = t),
      (t.child = l)
    );
  }
  function ks(l, t, e, a, u) {
    if (l !== null) {
      var n = l.memoizedProps;
      if (ju(n, a) && l.ref === t.ref)
        if (((Fl = !1), (t.pendingProps = a = n), $c(l, u)))
          (l.flags & 131072) !== 0 && (Fl = !0);
        else return ((t.lanes = l.lanes), Ae(l, t, u));
    }
    return Zc(l, t, e, a, u);
  }
  function Ws(l, t, e, a) {
    var u = a.children,
      n = l !== null ? l.memoizedState : null;
    if (
      (l === null &&
        t.stateNode === null &&
        (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null,
        }),
      a.mode === "hidden")
    ) {
      if ((t.flags & 128) !== 0) {
        if (((n = n !== null ? n.baseLanes | e : e), l !== null)) {
          for (a = t.child = l.child, u = 0; a !== null; )
            ((u = u | a.lanes | a.childLanes), (a = a.sibling));
          a = u & ~n;
        } else ((a = 0), (t.child = null));
        return $s(l, t, n, e, a);
      }
      if ((e & 536870912) !== 0)
        ((t.memoizedState = { baseLanes: 0, cachePool: null }),
          l !== null && Nn(t, n !== null ? n.cachePool : null),
          n !== null ? Io(t, n) : bc(),
          Po(t));
      else
        return (
          (a = t.lanes = 536870912),
          $s(l, t, n !== null ? n.baseLanes | e : e, e, a)
        );
    } else
      n !== null
        ? (Nn(t, n.cachePool), Io(t, n), Ke(), (t.memoizedState = null))
        : (l !== null && Nn(t, null), bc(), Ke());
    return (rt(l, t, u, e), t.child);
  }
  function wu(l, t) {
    return (
      (l !== null && l.tag === 22) ||
        t.stateNode !== null ||
        (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null,
        }),
      t.sibling
    );
  }
  function $s(l, t, e, a, u) {
    var n = hc();
    return (
      (n = n === null ? null : { parent: Wl._currentValue, pool: n }),
      (t.memoizedState = { baseLanes: e, cachePool: n }),
      l !== null && Nn(t, null),
      bc(),
      Po(t),
      l !== null && wa(l, t, a, !0),
      (t.childLanes = u),
      null
    );
  }
  function In(l, t) {
    return (
      (t = li({ mode: t.mode, children: t.children }, l.mode)),
      (t.ref = l.ref),
      (l.child = t),
      (t.return = l),
      t
    );
  }
  function Fs(l, t, e) {
    return (
      Aa(t, l.child, null, e),
      (l = In(t, t.pendingProps)),
      (l.flags |= 2),
      Rt(t),
      (t.memoizedState = null),
      l
    );
  }
  function Id(l, t, e) {
    var a = t.pendingProps,
      u = (t.flags & 128) !== 0;
    if (((t.flags &= -129), l === null)) {
      if (hl) {
        if (a.mode === "hidden")
          return ((l = In(t, a)), (t.lanes = 536870912), wu(null, l));
        if (
          (Tc(t),
          (l = Nl)
            ? ((l = or(l, Zt)),
              (l = l !== null && l.data === "&" ? l : null),
              l !== null &&
                ((t.memoizedState = {
                  dehydrated: l,
                  treeContext: qe !== null ? { id: ce, overflow: fe } : null,
                  retryLane: 536870912,
                  hydrationErrors: null,
                }),
                (e = Ho(l)),
                (e.return = t),
                (t.child = e),
                (ot = t),
                (Nl = null)))
            : (l = null),
          l === null)
        )
          throw Ge(t);
        return ((t.lanes = 536870912), null);
      }
      return In(t, a);
    }
    var n = l.memoizedState;
    if (n !== null) {
      var i = n.dehydrated;
      if ((Tc(t), u))
        if (t.flags & 256) ((t.flags &= -257), (t = Fs(l, t, e)));
        else if (t.memoizedState !== null)
          ((t.child = l.child), (t.flags |= 128), (t = null));
        else throw Error(h(558));
      else if (
        (Fl || wa(l, t, e, !1), (u = (e & l.childLanes) !== 0), Fl || u)
      ) {
        if (
          ((a = jl),
          a !== null && ((i = Eu(a, e)), i !== 0 && i !== n.retryLane))
        )
          throw ((n.retryLane = i), ga(l, i), Mt(a, l, i), Lc);
        (oi(), (t = Fs(l, t, e)));
      } else
        ((l = n.treeContext),
          (Nl = Jt(i.nextSibling)),
          (ot = t),
          (hl = !0),
          (Xe = null),
          (Zt = !1),
          l !== null && Yo(t, l),
          (t = In(t, a)),
          (t.flags |= 4096));
      return t;
    }
    return (
      (l = Se(l.child, { mode: a.mode, children: a.children })),
      (l.ref = t.ref),
      (t.child = l),
      (l.return = t),
      l
    );
  }
  function Pn(l, t) {
    var e = t.ref;
    if (e === null) l !== null && l.ref !== null && (t.flags |= 4194816);
    else {
      if (typeof e != "function" && typeof e != "object") throw Error(h(284));
      (l === null || l.ref !== e) && (t.flags |= 4194816);
    }
  }
  function Zc(l, t, e, a, u) {
    return (
      pa(t),
      (e = Ec(l, t, e, a, void 0, u)),
      (a = Ac()),
      l !== null && !Fl
        ? (Mc(l, t, u), Ae(l, t, u))
        : (hl && a && uc(t), (t.flags |= 1), rt(l, t, e, u), t.child)
    );
  }
  function Is(l, t, e, a, u, n) {
    return (
      pa(t),
      (t.updateQueue = null),
      (e = ts(t, a, e, u)),
      ls(l),
      (a = Ac()),
      l !== null && !Fl
        ? (Mc(l, t, n), Ae(l, t, n))
        : (hl && a && uc(t), (t.flags |= 1), rt(l, t, e, n), t.child)
    );
  }
  function Ps(l, t, e, a, u) {
    if ((pa(t), t.stateNode === null)) {
      var n = Za,
        i = e.contextType;
      (typeof i == "object" && i !== null && (n = st(i)),
        (n = new e(a, n)),
        (t.memoizedState =
          n.state !== null && n.state !== void 0 ? n.state : null),
        (n.updater = Gc),
        (t.stateNode = n),
        (n._reactInternals = t),
        (n = t.stateNode),
        (n.props = a),
        (n.state = t.memoizedState),
        (n.refs = {}),
        mc(t),
        (i = e.contextType),
        (n.context = typeof i == "object" && i !== null ? st(i) : Za),
        (n.state = t.memoizedState),
        (i = e.getDerivedStateFromProps),
        typeof i == "function" && (Xc(t, e, i, a), (n.state = t.memoizedState)),
        typeof e.getDerivedStateFromProps == "function" ||
          typeof n.getSnapshotBeforeUpdate == "function" ||
          (typeof n.UNSAFE_componentWillMount != "function" &&
            typeof n.componentWillMount != "function") ||
          ((i = n.state),
          typeof n.componentWillMount == "function" && n.componentWillMount(),
          typeof n.UNSAFE_componentWillMount == "function" &&
            n.UNSAFE_componentWillMount(),
          i !== n.state && Gc.enqueueReplaceState(n, n.state, null),
          Lu(t, a, n, u),
          Qu(),
          (n.state = t.memoizedState)),
        typeof n.componentDidMount == "function" && (t.flags |= 4194308),
        (a = !0));
    } else if (l === null) {
      n = t.stateNode;
      var c = t.memoizedProps,
        o = xa(e, c);
      n.props = o;
      var g = n.context,
        z = e.contextType;
      ((i = Za), typeof z == "object" && z !== null && (i = st(z)));
      var M = e.getDerivedStateFromProps;
      ((z =
        typeof M == "function" ||
        typeof n.getSnapshotBeforeUpdate == "function"),
        (c = t.pendingProps !== c),
        z ||
          (typeof n.UNSAFE_componentWillReceiveProps != "function" &&
            typeof n.componentWillReceiveProps != "function") ||
          ((c || g !== i) && Xs(t, n, a, i)),
        (Le = !1));
      var v = t.memoizedState;
      ((n.state = v),
        Lu(t, a, n, u),
        Qu(),
        (g = t.memoizedState),
        c || v !== g || Le
          ? (typeof M == "function" && (Xc(t, e, M, a), (g = t.memoizedState)),
            (o = Le || qs(t, e, o, a, v, g, i))
              ? (z ||
                  (typeof n.UNSAFE_componentWillMount != "function" &&
                    typeof n.componentWillMount != "function") ||
                  (typeof n.componentWillMount == "function" &&
                    n.componentWillMount(),
                  typeof n.UNSAFE_componentWillMount == "function" &&
                    n.UNSAFE_componentWillMount()),
                typeof n.componentDidMount == "function" &&
                  (t.flags |= 4194308))
              : (typeof n.componentDidMount == "function" &&
                  (t.flags |= 4194308),
                (t.memoizedProps = a),
                (t.memoizedState = g)),
            (n.props = a),
            (n.state = g),
            (n.context = i),
            (a = o))
          : (typeof n.componentDidMount == "function" && (t.flags |= 4194308),
            (a = !1)));
    } else {
      ((n = t.stateNode),
        gc(l, t),
        (i = t.memoizedProps),
        (z = xa(e, i)),
        (n.props = z),
        (M = t.pendingProps),
        (v = n.context),
        (g = e.contextType),
        (o = Za),
        typeof g == "object" && g !== null && (o = st(g)),
        (c = e.getDerivedStateFromProps),
        (g =
          typeof c == "function" ||
          typeof n.getSnapshotBeforeUpdate == "function") ||
          (typeof n.UNSAFE_componentWillReceiveProps != "function" &&
            typeof n.componentWillReceiveProps != "function") ||
          ((i !== M || v !== o) && Xs(t, n, a, o)),
        (Le = !1),
        (v = t.memoizedState),
        (n.state = v),
        Lu(t, a, n, u),
        Qu());
      var b = t.memoizedState;
      i !== M ||
      v !== b ||
      Le ||
      (l !== null && l.dependencies !== null && Hn(l.dependencies))
        ? (typeof c == "function" && (Xc(t, e, c, a), (b = t.memoizedState)),
          (z =
            Le ||
            qs(t, e, z, a, v, b, o) ||
            (l !== null && l.dependencies !== null && Hn(l.dependencies)))
            ? (g ||
                (typeof n.UNSAFE_componentWillUpdate != "function" &&
                  typeof n.componentWillUpdate != "function") ||
                (typeof n.componentWillUpdate == "function" &&
                  n.componentWillUpdate(a, b, o),
                typeof n.UNSAFE_componentWillUpdate == "function" &&
                  n.UNSAFE_componentWillUpdate(a, b, o)),
              typeof n.componentDidUpdate == "function" && (t.flags |= 4),
              typeof n.getSnapshotBeforeUpdate == "function" &&
                (t.flags |= 1024))
            : (typeof n.componentDidUpdate != "function" ||
                (i === l.memoizedProps && v === l.memoizedState) ||
                (t.flags |= 4),
              typeof n.getSnapshotBeforeUpdate != "function" ||
                (i === l.memoizedProps && v === l.memoizedState) ||
                (t.flags |= 1024),
              (t.memoizedProps = a),
              (t.memoizedState = b)),
          (n.props = a),
          (n.state = b),
          (n.context = o),
          (a = z))
        : (typeof n.componentDidUpdate != "function" ||
            (i === l.memoizedProps && v === l.memoizedState) ||
            (t.flags |= 4),
          typeof n.getSnapshotBeforeUpdate != "function" ||
            (i === l.memoizedProps && v === l.memoizedState) ||
            (t.flags |= 1024),
          (a = !1));
    }
    return (
      (n = a),
      Pn(l, t),
      (a = (t.flags & 128) !== 0),
      n || a
        ? ((n = t.stateNode),
          (e =
            a && typeof e.getDerivedStateFromError != "function"
              ? null
              : n.render()),
          (t.flags |= 1),
          l !== null && a
            ? ((t.child = Aa(t, l.child, null, u)),
              (t.child = Aa(t, null, e, u)))
            : rt(l, t, e, u),
          (t.memoizedState = n.state),
          (l = t.child))
        : (l = Ae(l, t, u)),
      l
    );
  }
  function l0(l, t, e, a) {
    return (Sa(), (t.flags |= 256), rt(l, t, e, a), t.child);
  }
  var Vc = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null,
  };
  function Jc(l) {
    return { baseLanes: l, cachePool: Zo() };
  }
  function Kc(l, t, e) {
    return ((l = l !== null ? l.childLanes & ~e : 0), t && (l |= jt), l);
  }
  function t0(l, t, e) {
    var a = t.pendingProps,
      u = !1,
      n = (t.flags & 128) !== 0,
      i;
    if (
      ((i = n) ||
        (i =
          l !== null && l.memoizedState === null ? !1 : (Kl.current & 2) !== 0),
      i && ((u = !0), (t.flags &= -129)),
      (i = (t.flags & 32) !== 0),
      (t.flags &= -33),
      l === null)
    ) {
      if (hl) {
        if (
          (u ? Je(t) : Ke(),
          (l = Nl)
            ? ((l = or(l, Zt)),
              (l = l !== null && l.data !== "&" ? l : null),
              l !== null &&
                ((t.memoizedState = {
                  dehydrated: l,
                  treeContext: qe !== null ? { id: ce, overflow: fe } : null,
                  retryLane: 536870912,
                  hydrationErrors: null,
                }),
                (e = Ho(l)),
                (e.return = t),
                (t.child = e),
                (ot = t),
                (Nl = null)))
            : (l = null),
          l === null)
        )
          throw Ge(t);
        return (Df(l) ? (t.lanes = 32) : (t.lanes = 536870912), null);
      }
      var c = a.children;
      return (
        (a = a.fallback),
        u
          ? (Ke(),
            (u = t.mode),
            (c = li({ mode: "hidden", children: c }, u)),
            (a = va(a, u, e, null)),
            (c.return = t),
            (a.return = t),
            (c.sibling = a),
            (t.child = c),
            (a = t.child),
            (a.memoizedState = Jc(e)),
            (a.childLanes = Kc(l, i, e)),
            (t.memoizedState = Vc),
            wu(null, a))
          : (Je(t), wc(t, c))
      );
    }
    var o = l.memoizedState;
    if (o !== null && ((c = o.dehydrated), c !== null)) {
      if (n)
        t.flags & 256
          ? (Je(t), (t.flags &= -257), (t = kc(l, t, e)))
          : t.memoizedState !== null
            ? (Ke(), (t.child = l.child), (t.flags |= 128), (t = null))
            : (Ke(),
              (c = a.fallback),
              (u = t.mode),
              (a = li({ mode: "visible", children: a.children }, u)),
              (c = va(c, u, e, null)),
              (c.flags |= 2),
              (a.return = t),
              (c.return = t),
              (a.sibling = c),
              (t.child = a),
              Aa(t, l.child, null, e),
              (a = t.child),
              (a.memoizedState = Jc(e)),
              (a.childLanes = Kc(l, i, e)),
              (t.memoizedState = Vc),
              (t = wu(null, a)));
      else if ((Je(t), Df(c))) {
        if (((i = c.nextSibling && c.nextSibling.dataset), i)) var g = i.dgst;
        ((i = g),
          (a = Error(h(419))),
          (a.stack = ""),
          (a.digest = i),
          Bu({ value: a, source: null, stack: null }),
          (t = kc(l, t, e)));
      } else if (
        (Fl || wa(l, t, e, !1), (i = (e & l.childLanes) !== 0), Fl || i)
      ) {
        if (
          ((i = jl),
          i !== null && ((a = Eu(i, e)), a !== 0 && a !== o.retryLane))
        )
          throw ((o.retryLane = a), ga(l, a), Mt(i, l, a), Lc);
        (Of(c) || oi(), (t = kc(l, t, e)));
      } else
        Of(c)
          ? ((t.flags |= 192), (t.child = l.child), (t = null))
          : ((l = o.treeContext),
            (Nl = Jt(c.nextSibling)),
            (ot = t),
            (hl = !0),
            (Xe = null),
            (Zt = !1),
            l !== null && Yo(t, l),
            (t = wc(t, a.children)),
            (t.flags |= 4096));
      return t;
    }
    return u
      ? (Ke(),
        (c = a.fallback),
        (u = t.mode),
        (o = l.child),
        (g = o.sibling),
        (a = Se(o, { mode: "hidden", children: a.children })),
        (a.subtreeFlags = o.subtreeFlags & 65011712),
        g !== null ? (c = Se(g, c)) : ((c = va(c, u, e, null)), (c.flags |= 2)),
        (c.return = t),
        (a.return = t),
        (a.sibling = c),
        (t.child = a),
        wu(null, a),
        (a = t.child),
        (c = l.child.memoizedState),
        c === null
          ? (c = Jc(e))
          : ((u = c.cachePool),
            u !== null
              ? ((o = Wl._currentValue),
                (u = u.parent !== o ? { parent: o, pool: o } : u))
              : (u = Zo()),
            (c = { baseLanes: c.baseLanes | e, cachePool: u })),
        (a.memoizedState = c),
        (a.childLanes = Kc(l, i, e)),
        (t.memoizedState = Vc),
        wu(l.child, a))
      : (Je(t),
        (e = l.child),
        (l = e.sibling),
        (e = Se(e, { mode: "visible", children: a.children })),
        (e.return = t),
        (e.sibling = null),
        l !== null &&
          ((i = t.deletions),
          i === null ? ((t.deletions = [l]), (t.flags |= 16)) : i.push(l)),
        (t.child = e),
        (t.memoizedState = null),
        e);
  }
  function wc(l, t) {
    return (
      (t = li({ mode: "visible", children: t }, l.mode)),
      (t.return = l),
      (l.child = t)
    );
  }
  function li(l, t) {
    return ((l = Ot(22, l, null, t)), (l.lanes = 0), l);
  }
  function kc(l, t, e) {
    return (
      Aa(t, l.child, null, e),
      (l = wc(t, t.pendingProps.children)),
      (l.flags |= 2),
      (t.memoizedState = null),
      l
    );
  }
  function e0(l, t, e) {
    l.lanes |= t;
    var a = l.alternate;
    (a !== null && (a.lanes |= t), oc(l.return, t, e));
  }
  function Wc(l, t, e, a, u, n) {
    var i = l.memoizedState;
    i === null
      ? (l.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: a,
          tail: e,
          tailMode: u,
          treeForkCount: n,
        })
      : ((i.isBackwards = t),
        (i.rendering = null),
        (i.renderingStartTime = 0),
        (i.last = a),
        (i.tail = e),
        (i.tailMode = u),
        (i.treeForkCount = n));
  }
  function a0(l, t, e) {
    var a = t.pendingProps,
      u = a.revealOrder,
      n = a.tail;
    a = a.children;
    var i = Kl.current,
      c = (i & 2) !== 0;
    if (
      (c ? ((i = (i & 1) | 2), (t.flags |= 128)) : (i &= 1),
      C(Kl, i),
      rt(l, t, a, e),
      (a = hl ? Hu : 0),
      !c && l !== null && (l.flags & 128) !== 0)
    )
      l: for (l = t.child; l !== null; ) {
        if (l.tag === 13) l.memoizedState !== null && e0(l, e, t);
        else if (l.tag === 19) e0(l, e, t);
        else if (l.child !== null) {
          ((l.child.return = l), (l = l.child));
          continue;
        }
        if (l === t) break l;
        for (; l.sibling === null; ) {
          if (l.return === null || l.return === t) break l;
          l = l.return;
        }
        ((l.sibling.return = l.return), (l = l.sibling));
      }
    switch (u) {
      case "forwards":
        for (e = t.child, u = null; e !== null; )
          ((l = e.alternate),
            l !== null && Ln(l) === null && (u = e),
            (e = e.sibling));
        ((e = u),
          e === null
            ? ((u = t.child), (t.child = null))
            : ((u = e.sibling), (e.sibling = null)),
          Wc(t, !1, u, e, n, a));
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        for (e = null, u = t.child, t.child = null; u !== null; ) {
          if (((l = u.alternate), l !== null && Ln(l) === null)) {
            t.child = u;
            break;
          }
          ((l = u.sibling), (u.sibling = e), (e = u), (u = l));
        }
        Wc(t, !0, e, null, n, a);
        break;
      case "together":
        Wc(t, !1, null, null, void 0, a);
        break;
      default:
        t.memoizedState = null;
    }
    return t.child;
  }
  function Ae(l, t, e) {
    if (
      (l !== null && (t.dependencies = l.dependencies),
      (We |= t.lanes),
      (e & t.childLanes) === 0)
    )
      if (l !== null) {
        if ((wa(l, t, e, !1), (e & t.childLanes) === 0)) return null;
      } else return null;
    if (l !== null && t.child !== l.child) throw Error(h(153));
    if (t.child !== null) {
      for (
        l = t.child, e = Se(l, l.pendingProps), t.child = e, e.return = t;
        l.sibling !== null;
      )
        ((l = l.sibling),
          (e = e.sibling = Se(l, l.pendingProps)),
          (e.return = t));
      e.sibling = null;
    }
    return t.child;
  }
  function $c(l, t) {
    return (l.lanes & t) !== 0
      ? !0
      : ((l = l.dependencies), !!(l !== null && Hn(l)));
  }
  function Pd(l, t, e) {
    switch (t.tag) {
      case 3:
        (kl(t, t.stateNode.containerInfo),
          Qe(t, Wl, l.memoizedState.cache),
          Sa());
        break;
      case 27:
      case 5:
        ee(t);
        break;
      case 4:
        kl(t, t.stateNode.containerInfo);
        break;
      case 10:
        Qe(t, t.type, t.memoizedProps.value);
        break;
      case 31:
        if (t.memoizedState !== null) return ((t.flags |= 128), Tc(t), null);
        break;
      case 13:
        var a = t.memoizedState;
        if (a !== null)
          return a.dehydrated !== null
            ? (Je(t), (t.flags |= 128), null)
            : (e & t.child.childLanes) !== 0
              ? t0(l, t, e)
              : (Je(t), (l = Ae(l, t, e)), l !== null ? l.sibling : null);
        Je(t);
        break;
      case 19:
        var u = (l.flags & 128) !== 0;
        if (
          ((a = (e & t.childLanes) !== 0),
          a || (wa(l, t, e, !1), (a = (e & t.childLanes) !== 0)),
          u)
        ) {
          if (a) return a0(l, t, e);
          t.flags |= 128;
        }
        if (
          ((u = t.memoizedState),
          u !== null &&
            ((u.rendering = null), (u.tail = null), (u.lastEffect = null)),
          C(Kl, Kl.current),
          a)
        )
          break;
        return null;
      case 22:
        return ((t.lanes = 0), Ws(l, t, e, t.pendingProps));
      case 24:
        Qe(t, Wl, l.memoizedState.cache);
    }
    return Ae(l, t, e);
  }
  function u0(l, t, e) {
    if (l !== null)
      if (l.memoizedProps !== t.pendingProps) Fl = !0;
      else {
        if (!$c(l, e) && (t.flags & 128) === 0) return ((Fl = !1), Pd(l, t, e));
        Fl = (l.flags & 131072) !== 0;
      }
    else ((Fl = !1), hl && (t.flags & 1048576) !== 0 && No(t, Hu, t.index));
    switch (((t.lanes = 0), t.tag)) {
      case 16:
        l: {
          var a = t.pendingProps;
          if (((l = za(t.elementType)), (t.type = l), typeof l == "function"))
            tc(l)
              ? ((a = xa(l, a)), (t.tag = 1), (t = Ps(null, t, l, a, e)))
              : ((t.tag = 0), (t = Zc(null, t, l, a, e)));
          else {
            if (l != null) {
              var u = l.$$typeof;
              if (u === Hl) {
                ((t.tag = 11), (t = Ks(null, t, l, a, e)));
                break l;
              } else if (u === G) {
                ((t.tag = 14), (t = ws(null, t, l, a, e)));
                break l;
              }
            }
            throw ((t = el(l) || l), Error(h(306, t, "")));
          }
        }
        return t;
      case 0:
        return Zc(l, t, t.type, t.pendingProps, e);
      case 1:
        return ((a = t.type), (u = xa(a, t.pendingProps)), Ps(l, t, a, u, e));
      case 3:
        l: {
          if ((kl(t, t.stateNode.containerInfo), l === null))
            throw Error(h(387));
          a = t.pendingProps;
          var n = t.memoizedState;
          ((u = n.element), gc(l, t), Lu(t, a, null, e));
          var i = t.memoizedState;
          if (
            ((a = i.cache),
            Qe(t, Wl, a),
            a !== n.cache && sc(t, [Wl], e, !0),
            Qu(),
            (a = i.element),
            n.isDehydrated)
          )
            if (
              ((n = { element: a, isDehydrated: !1, cache: i.cache }),
              (t.updateQueue.baseState = n),
              (t.memoizedState = n),
              t.flags & 256)
            ) {
              t = l0(l, t, a, e);
              break l;
            } else if (a !== u) {
              ((u = Gt(Error(h(424)), t)), Bu(u), (t = l0(l, t, a, e)));
              break l;
            } else
              for (
                l = t.stateNode.containerInfo,
                  l.nodeType === 9
                    ? (l = l.body)
                    : (l = l.nodeName === "HTML" ? l.ownerDocument.body : l),
                  Nl = Jt(l.firstChild),
                  ot = t,
                  hl = !0,
                  Xe = null,
                  Zt = !0,
                  e = Wo(t, null, a, e),
                  t.child = e;
                e;
              )
                ((e.flags = (e.flags & -3) | 4096), (e = e.sibling));
          else {
            if ((Sa(), a === u)) {
              t = Ae(l, t, e);
              break l;
            }
            rt(l, t, a, e);
          }
          t = t.child;
        }
        return t;
      case 26:
        return (
          Pn(l, t),
          l === null
            ? (e = mr(t.type, null, t.pendingProps, null))
              ? (t.memoizedState = e)
              : hl ||
                ((e = t.type),
                (l = t.pendingProps),
                (a = gi(ll.current).createElement(e)),
                (a[lt] = t),
                (a[ht] = l),
                dt(a, e, l),
                nl(a),
                (t.stateNode = a))
            : (t.memoizedState = mr(
                t.type,
                l.memoizedProps,
                t.pendingProps,
                l.memoizedState,
              )),
          null
        );
      case 27:
        return (
          ee(t),
          l === null &&
            hl &&
            ((a = t.stateNode = dr(t.type, t.pendingProps, ll.current)),
            (ot = t),
            (Zt = !0),
            (u = Nl),
            la(t.type) ? ((Rf = u), (Nl = Jt(a.firstChild))) : (Nl = u)),
          rt(l, t, t.pendingProps.children, e),
          Pn(l, t),
          l === null && (t.flags |= 4194304),
          t.child
        );
      case 5:
        return (
          l === null &&
            hl &&
            ((u = a = Nl) &&
              ((a = Dh(a, t.type, t.pendingProps, Zt)),
              a !== null
                ? ((t.stateNode = a),
                  (ot = t),
                  (Nl = Jt(a.firstChild)),
                  (Zt = !1),
                  (u = !0))
                : (u = !1)),
            u || Ge(t)),
          ee(t),
          (u = t.type),
          (n = t.pendingProps),
          (i = l !== null ? l.memoizedProps : null),
          (a = n.children),
          Mf(u, n) ? (a = null) : i !== null && Mf(u, i) && (t.flags |= 32),
          t.memoizedState !== null &&
            ((u = Ec(l, t, Vd, null, null, e)), (on._currentValue = u)),
          Pn(l, t),
          rt(l, t, a, e),
          t.child
        );
      case 6:
        return (
          l === null &&
            hl &&
            ((l = e = Nl) &&
              ((e = Rh(e, t.pendingProps, Zt)),
              e !== null
                ? ((t.stateNode = e), (ot = t), (Nl = null), (l = !0))
                : (l = !1)),
            l || Ge(t)),
          null
        );
      case 13:
        return t0(l, t, e);
      case 4:
        return (
          kl(t, t.stateNode.containerInfo),
          (a = t.pendingProps),
          l === null ? (t.child = Aa(t, null, a, e)) : rt(l, t, a, e),
          t.child
        );
      case 11:
        return Ks(l, t, t.type, t.pendingProps, e);
      case 7:
        return (rt(l, t, t.pendingProps, e), t.child);
      case 8:
        return (rt(l, t, t.pendingProps.children, e), t.child);
      case 12:
        return (rt(l, t, t.pendingProps.children, e), t.child);
      case 10:
        return (
          (a = t.pendingProps),
          Qe(t, t.type, a.value),
          rt(l, t, a.children, e),
          t.child
        );
      case 9:
        return (
          (u = t.type._context),
          (a = t.pendingProps.children),
          pa(t),
          (u = st(u)),
          (a = a(u)),
          (t.flags |= 1),
          rt(l, t, a, e),
          t.child
        );
      case 14:
        return ws(l, t, t.type, t.pendingProps, e);
      case 15:
        return ks(l, t, t.type, t.pendingProps, e);
      case 19:
        return a0(l, t, e);
      case 31:
        return Id(l, t, e);
      case 22:
        return Ws(l, t, e, t.pendingProps);
      case 24:
        return (
          pa(t),
          (a = st(Wl)),
          l === null
            ? ((u = hc()),
              u === null &&
                ((u = jl),
                (n = rc()),
                (u.pooledCache = n),
                n.refCount++,
                n !== null && (u.pooledCacheLanes |= e),
                (u = n)),
              (t.memoizedState = { parent: a, cache: u }),
              mc(t),
              Qe(t, Wl, u))
            : ((l.lanes & e) !== 0 && (gc(l, t), Lu(t, null, null, e), Qu()),
              (u = l.memoizedState),
              (n = t.memoizedState),
              u.parent !== a
                ? ((u = { parent: a, cache: a }),
                  (t.memoizedState = u),
                  t.lanes === 0 &&
                    (t.memoizedState = t.updateQueue.baseState = u),
                  Qe(t, Wl, a))
                : ((a = n.cache),
                  Qe(t, Wl, a),
                  a !== u.cache && sc(t, [Wl], e, !0))),
          rt(l, t, t.pendingProps.children, e),
          t.child
        );
      case 29:
        throw t.pendingProps;
    }
    throw Error(h(156, t.tag));
  }
  function Me(l) {
    l.flags |= 4;
  }
  function Fc(l, t, e, a, u) {
    if (((t = (l.mode & 32) !== 0) && (t = !1), t)) {
      if (((l.flags |= 16777216), (u & 335544128) === u))
        if (l.stateNode.complete) l.flags |= 8192;
        else if (U0()) l.flags |= 8192;
        else throw ((Ea = qn), yc);
    } else l.flags &= -16777217;
  }
  function n0(l, t) {
    if (t.type !== "stylesheet" || (t.state.loading & 4) !== 0)
      l.flags &= -16777217;
    else if (((l.flags |= 16777216), !pr(t)))
      if (U0()) l.flags |= 8192;
      else throw ((Ea = qn), yc);
  }
  function ti(l, t) {
    (t !== null && (l.flags |= 4),
      l.flags & 16384 &&
        ((t = l.tag !== 22 ? bn() : 536870912), (l.lanes |= t), (nu |= t)));
  }
  function ku(l, t) {
    if (!hl)
      switch (l.tailMode) {
        case "hidden":
          t = l.tail;
          for (var e = null; t !== null; )
            (t.alternate !== null && (e = t), (t = t.sibling));
          e === null ? (l.tail = null) : (e.sibling = null);
          break;
        case "collapsed":
          e = l.tail;
          for (var a = null; e !== null; )
            (e.alternate !== null && (a = e), (e = e.sibling));
          a === null
            ? t || l.tail === null
              ? (l.tail = null)
              : (l.tail.sibling = null)
            : (a.sibling = null);
      }
  }
  function Yl(l) {
    var t = l.alternate !== null && l.alternate.child === l.child,
      e = 0,
      a = 0;
    if (t)
      for (var u = l.child; u !== null; )
        ((e |= u.lanes | u.childLanes),
          (a |= u.subtreeFlags & 65011712),
          (a |= u.flags & 65011712),
          (u.return = l),
          (u = u.sibling));
    else
      for (u = l.child; u !== null; )
        ((e |= u.lanes | u.childLanes),
          (a |= u.subtreeFlags),
          (a |= u.flags),
          (u.return = l),
          (u = u.sibling));
    return ((l.subtreeFlags |= a), (l.childLanes = e), t);
  }
  function lh(l, t, e) {
    var a = t.pendingProps;
    switch ((nc(t), t.tag)) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return (Yl(t), null);
      case 1:
        return (Yl(t), null);
      case 3:
        return (
          (e = t.stateNode),
          (a = null),
          l !== null && (a = l.memoizedState.cache),
          t.memoizedState.cache !== a && (t.flags |= 2048),
          Te(Wl),
          Rl(),
          e.pendingContext &&
            ((e.context = e.pendingContext), (e.pendingContext = null)),
          (l === null || l.child === null) &&
            (Ka(t)
              ? Me(t)
              : l === null ||
                (l.memoizedState.isDehydrated && (t.flags & 256) === 0) ||
                ((t.flags |= 1024), cc())),
          Yl(t),
          null
        );
      case 26:
        var u = t.type,
          n = t.memoizedState;
        return (
          l === null
            ? (Me(t),
              n !== null ? (Yl(t), n0(t, n)) : (Yl(t), Fc(t, u, null, a, e)))
            : n
              ? n !== l.memoizedState
                ? (Me(t), Yl(t), n0(t, n))
                : (Yl(t), (t.flags &= -16777217))
              : ((l = l.memoizedProps),
                l !== a && Me(t),
                Yl(t),
                Fc(t, u, l, a, e)),
          null
        );
      case 27:
        if (
          (ae(t),
          (e = ll.current),
          (u = t.type),
          l !== null && t.stateNode != null)
        )
          l.memoizedProps !== a && Me(t);
        else {
          if (!a) {
            if (t.stateNode === null) throw Error(h(166));
            return (Yl(t), null);
          }
          ((l = N.current),
            Ka(t) ? qo(t) : ((l = dr(u, a, e)), (t.stateNode = l), Me(t)));
        }
        return (Yl(t), null);
      case 5:
        if ((ae(t), (u = t.type), l !== null && t.stateNode != null))
          l.memoizedProps !== a && Me(t);
        else {
          if (!a) {
            if (t.stateNode === null) throw Error(h(166));
            return (Yl(t), null);
          }
          if (((n = N.current), Ka(t))) qo(t);
          else {
            var i = gi(ll.current);
            switch (n) {
              case 1:
                n = i.createElementNS("http://www.w3.org/2000/svg", u);
                break;
              case 2:
                n = i.createElementNS("http://www.w3.org/1998/Math/MathML", u);
                break;
              default:
                switch (u) {
                  case "svg":
                    n = i.createElementNS("http://www.w3.org/2000/svg", u);
                    break;
                  case "math":
                    n = i.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      u,
                    );
                    break;
                  case "script":
                    ((n = i.createElement("div")),
                      (n.innerHTML = "<script><\/script>"),
                      (n = n.removeChild(n.firstChild)));
                    break;
                  case "select":
                    ((n =
                      typeof a.is == "string"
                        ? i.createElement("select", { is: a.is })
                        : i.createElement("select")),
                      a.multiple
                        ? (n.multiple = !0)
                        : a.size && (n.size = a.size));
                    break;
                  default:
                    n =
                      typeof a.is == "string"
                        ? i.createElement(u, { is: a.is })
                        : i.createElement(u);
                }
            }
            ((n[lt] = t), (n[ht] = a));
            l: for (i = t.child; i !== null; ) {
              if (i.tag === 5 || i.tag === 6) n.appendChild(i.stateNode);
              else if (i.tag !== 4 && i.tag !== 27 && i.child !== null) {
                ((i.child.return = i), (i = i.child));
                continue;
              }
              if (i === t) break l;
              for (; i.sibling === null; ) {
                if (i.return === null || i.return === t) break l;
                i = i.return;
              }
              ((i.sibling.return = i.return), (i = i.sibling));
            }
            t.stateNode = n;
            l: switch ((dt(n, u, a), u)) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                a = !!a.autoFocus;
                break l;
              case "img":
                a = !0;
                break l;
              default:
                a = !1;
            }
            a && Me(t);
          }
        }
        return (
          Yl(t),
          Fc(t, t.type, l === null ? null : l.memoizedProps, t.pendingProps, e),
          null
        );
      case 6:
        if (l && t.stateNode != null) l.memoizedProps !== a && Me(t);
        else {
          if (typeof a != "string" && t.stateNode === null) throw Error(h(166));
          if (((l = ll.current), Ka(t))) {
            if (
              ((l = t.stateNode),
              (e = t.memoizedProps),
              (a = null),
              (u = ot),
              u !== null)
            )
              switch (u.tag) {
                case 27:
                case 5:
                  a = u.memoizedProps;
              }
            ((l[lt] = t),
              (l = !!(
                l.nodeValue === e ||
                (a !== null && a.suppressHydrationWarning === !0) ||
                tr(l.nodeValue, e)
              )),
              l || Ge(t, !0));
          } else
            ((l = gi(l).createTextNode(a)), (l[lt] = t), (t.stateNode = l));
        }
        return (Yl(t), null);
      case 31:
        if (((e = t.memoizedState), l === null || l.memoizedState !== null)) {
          if (((a = Ka(t)), e !== null)) {
            if (l === null) {
              if (!a) throw Error(h(318));
              if (
                ((l = t.memoizedState),
                (l = l !== null ? l.dehydrated : null),
                !l)
              )
                throw Error(h(557));
              l[lt] = t;
            } else
              (Sa(),
                (t.flags & 128) === 0 && (t.memoizedState = null),
                (t.flags |= 4));
            (Yl(t), (l = !1));
          } else
            ((e = cc()),
              l !== null &&
                l.memoizedState !== null &&
                (l.memoizedState.hydrationErrors = e),
              (l = !0));
          if (!l) return t.flags & 256 ? (Rt(t), t) : (Rt(t), null);
          if ((t.flags & 128) !== 0) throw Error(h(558));
        }
        return (Yl(t), null);
      case 13:
        if (
          ((a = t.memoizedState),
          l === null ||
            (l.memoizedState !== null && l.memoizedState.dehydrated !== null))
        ) {
          if (((u = Ka(t)), a !== null && a.dehydrated !== null)) {
            if (l === null) {
              if (!u) throw Error(h(318));
              if (
                ((u = t.memoizedState),
                (u = u !== null ? u.dehydrated : null),
                !u)
              )
                throw Error(h(317));
              u[lt] = t;
            } else
              (Sa(),
                (t.flags & 128) === 0 && (t.memoizedState = null),
                (t.flags |= 4));
            (Yl(t), (u = !1));
          } else
            ((u = cc()),
              l !== null &&
                l.memoizedState !== null &&
                (l.memoizedState.hydrationErrors = u),
              (u = !0));
          if (!u) return t.flags & 256 ? (Rt(t), t) : (Rt(t), null);
        }
        return (
          Rt(t),
          (t.flags & 128) !== 0
            ? ((t.lanes = e), t)
            : ((e = a !== null),
              (l = l !== null && l.memoizedState !== null),
              e &&
                ((a = t.child),
                (u = null),
                a.alternate !== null &&
                  a.alternate.memoizedState !== null &&
                  a.alternate.memoizedState.cachePool !== null &&
                  (u = a.alternate.memoizedState.cachePool.pool),
                (n = null),
                a.memoizedState !== null &&
                  a.memoizedState.cachePool !== null &&
                  (n = a.memoizedState.cachePool.pool),
                n !== u && (a.flags |= 2048)),
              e !== l && e && (t.child.flags |= 8192),
              ti(t, t.updateQueue),
              Yl(t),
              null)
        );
      case 4:
        return (Rl(), l === null && pf(t.stateNode.containerInfo), Yl(t), null);
      case 10:
        return (Te(t.type), Yl(t), null);
      case 19:
        if ((A(Kl), (a = t.memoizedState), a === null)) return (Yl(t), null);
        if (((u = (t.flags & 128) !== 0), (n = a.rendering), n === null))
          if (u) ku(a, !1);
          else {
            if (Ll !== 0 || (l !== null && (l.flags & 128) !== 0))
              for (l = t.child; l !== null; ) {
                if (((n = Ln(l)), n !== null)) {
                  for (
                    t.flags |= 128,
                      ku(a, !1),
                      l = n.updateQueue,
                      t.updateQueue = l,
                      ti(t, l),
                      t.subtreeFlags = 0,
                      l = e,
                      e = t.child;
                    e !== null;
                  )
                    (Co(e, l), (e = e.sibling));
                  return (
                    C(Kl, (Kl.current & 1) | 2),
                    hl && be(t, a.treeForkCount),
                    t.child
                  );
                }
                l = l.sibling;
              }
            a.tail !== null &&
              vl() > ii &&
              ((t.flags |= 128), (u = !0), ku(a, !1), (t.lanes = 4194304));
          }
        else {
          if (!u)
            if (((l = Ln(n)), l !== null)) {
              if (
                ((t.flags |= 128),
                (u = !0),
                (l = l.updateQueue),
                (t.updateQueue = l),
                ti(t, l),
                ku(a, !0),
                a.tail === null &&
                  a.tailMode === "hidden" &&
                  !n.alternate &&
                  !hl)
              )
                return (Yl(t), null);
            } else
              2 * vl() - a.renderingStartTime > ii &&
                e !== 536870912 &&
                ((t.flags |= 128), (u = !0), ku(a, !1), (t.lanes = 4194304));
          a.isBackwards
            ? ((n.sibling = t.child), (t.child = n))
            : ((l = a.last),
              l !== null ? (l.sibling = n) : (t.child = n),
              (a.last = n));
        }
        return a.tail !== null
          ? ((l = a.tail),
            (a.rendering = l),
            (a.tail = l.sibling),
            (a.renderingStartTime = vl()),
            (l.sibling = null),
            (e = Kl.current),
            C(Kl, u ? (e & 1) | 2 : e & 1),
            hl && be(t, a.treeForkCount),
            l)
          : (Yl(t), null);
      case 22:
      case 23:
        return (
          Rt(t),
          pc(),
          (a = t.memoizedState !== null),
          l !== null
            ? (l.memoizedState !== null) !== a && (t.flags |= 8192)
            : a && (t.flags |= 8192),
          a
            ? (e & 536870912) !== 0 &&
              (t.flags & 128) === 0 &&
              (Yl(t), t.subtreeFlags & 6 && (t.flags |= 8192))
            : Yl(t),
          (e = t.updateQueue),
          e !== null && ti(t, e.retryQueue),
          (e = null),
          l !== null &&
            l.memoizedState !== null &&
            l.memoizedState.cachePool !== null &&
            (e = l.memoizedState.cachePool.pool),
          (a = null),
          t.memoizedState !== null &&
            t.memoizedState.cachePool !== null &&
            (a = t.memoizedState.cachePool.pool),
          a !== e && (t.flags |= 2048),
          l !== null && A(Ta),
          null
        );
      case 24:
        return (
          (e = null),
          l !== null && (e = l.memoizedState.cache),
          t.memoizedState.cache !== e && (t.flags |= 2048),
          Te(Wl),
          Yl(t),
          null
        );
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(h(156, t.tag));
  }
  function th(l, t) {
    switch ((nc(t), t.tag)) {
      case 1:
        return (
          (l = t.flags),
          l & 65536 ? ((t.flags = (l & -65537) | 128), t) : null
        );
      case 3:
        return (
          Te(Wl),
          Rl(),
          (l = t.flags),
          (l & 65536) !== 0 && (l & 128) === 0
            ? ((t.flags = (l & -65537) | 128), t)
            : null
        );
      case 26:
      case 27:
      case 5:
        return (ae(t), null);
      case 31:
        if (t.memoizedState !== null) {
          if ((Rt(t), t.alternate === null)) throw Error(h(340));
          Sa();
        }
        return (
          (l = t.flags),
          l & 65536 ? ((t.flags = (l & -65537) | 128), t) : null
        );
      case 13:
        if (
          (Rt(t), (l = t.memoizedState), l !== null && l.dehydrated !== null)
        ) {
          if (t.alternate === null) throw Error(h(340));
          Sa();
        }
        return (
          (l = t.flags),
          l & 65536 ? ((t.flags = (l & -65537) | 128), t) : null
        );
      case 19:
        return (A(Kl), null);
      case 4:
        return (Rl(), null);
      case 10:
        return (Te(t.type), null);
      case 22:
      case 23:
        return (
          Rt(t),
          pc(),
          l !== null && A(Ta),
          (l = t.flags),
          l & 65536 ? ((t.flags = (l & -65537) | 128), t) : null
        );
      case 24:
        return (Te(Wl), null);
      case 25:
        return null;
      default:
        return null;
    }
  }
  function i0(l, t) {
    switch ((nc(t), t.tag)) {
      case 3:
        (Te(Wl), Rl());
        break;
      case 26:
      case 27:
      case 5:
        ae(t);
        break;
      case 4:
        Rl();
        break;
      case 31:
        t.memoizedState !== null && Rt(t);
        break;
      case 13:
        Rt(t);
        break;
      case 19:
        A(Kl);
        break;
      case 10:
        Te(t.type);
        break;
      case 22:
      case 23:
        (Rt(t), pc(), l !== null && A(Ta));
        break;
      case 24:
        Te(Wl);
    }
  }
  function Wu(l, t) {
    try {
      var e = t.updateQueue,
        a = e !== null ? e.lastEffect : null;
      if (a !== null) {
        var u = a.next;
        e = u;
        do {
          if ((e.tag & l) === l) {
            a = void 0;
            var n = e.create,
              i = e.inst;
            ((a = n()), (i.destroy = a));
          }
          e = e.next;
        } while (e !== u);
      }
    } catch (c) {
      Al(t, t.return, c);
    }
  }
  function we(l, t, e) {
    try {
      var a = t.updateQueue,
        u = a !== null ? a.lastEffect : null;
      if (u !== null) {
        var n = u.next;
        a = n;
        do {
          if ((a.tag & l) === l) {
            var i = a.inst,
              c = i.destroy;
            if (c !== void 0) {
              ((i.destroy = void 0), (u = t));
              var o = e,
                g = c;
              try {
                g();
              } catch (z) {
                Al(u, o, z);
              }
            }
          }
          a = a.next;
        } while (a !== n);
      }
    } catch (z) {
      Al(t, t.return, z);
    }
  }
  function c0(l) {
    var t = l.updateQueue;
    if (t !== null) {
      var e = l.stateNode;
      try {
        Fo(t, e);
      } catch (a) {
        Al(l, l.return, a);
      }
    }
  }
  function f0(l, t, e) {
    ((e.props = xa(l.type, l.memoizedProps)), (e.state = l.memoizedState));
    try {
      e.componentWillUnmount();
    } catch (a) {
      Al(l, t, a);
    }
  }
  function $u(l, t) {
    try {
      var e = l.ref;
      if (e !== null) {
        switch (l.tag) {
          case 26:
          case 27:
          case 5:
            var a = l.stateNode;
            break;
          case 30:
            a = l.stateNode;
            break;
          default:
            a = l.stateNode;
        }
        typeof e == "function" ? (l.refCleanup = e(a)) : (e.current = a);
      }
    } catch (u) {
      Al(l, t, u);
    }
  }
  function oe(l, t) {
    var e = l.ref,
      a = l.refCleanup;
    if (e !== null)
      if (typeof a == "function")
        try {
          a();
        } catch (u) {
          Al(l, t, u);
        } finally {
          ((l.refCleanup = null),
            (l = l.alternate),
            l != null && (l.refCleanup = null));
        }
      else if (typeof e == "function")
        try {
          e(null);
        } catch (u) {
          Al(l, t, u);
        }
      else e.current = null;
  }
  function o0(l) {
    var t = l.type,
      e = l.memoizedProps,
      a = l.stateNode;
    try {
      l: switch (t) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          e.autoFocus && a.focus();
          break l;
        case "img":
          e.src ? (a.src = e.src) : e.srcSet && (a.srcset = e.srcSet);
      }
    } catch (u) {
      Al(l, l.return, u);
    }
  }
  function Ic(l, t, e) {
    try {
      var a = l.stateNode;
      (Eh(a, l.type, e, t), (a[ht] = t));
    } catch (u) {
      Al(l, l.return, u);
    }
  }
  function s0(l) {
    return (
      l.tag === 5 ||
      l.tag === 3 ||
      l.tag === 26 ||
      (l.tag === 27 && la(l.type)) ||
      l.tag === 4
    );
  }
  function Pc(l) {
    l: for (;;) {
      for (; l.sibling === null; ) {
        if (l.return === null || s0(l.return)) return null;
        l = l.return;
      }
      for (
        l.sibling.return = l.return, l = l.sibling;
        l.tag !== 5 && l.tag !== 6 && l.tag !== 18;
      ) {
        if (
          (l.tag === 27 && la(l.type)) ||
          l.flags & 2 ||
          l.child === null ||
          l.tag === 4
        )
          continue l;
        ((l.child.return = l), (l = l.child));
      }
      if (!(l.flags & 2)) return l.stateNode;
    }
  }
  function lf(l, t, e) {
    var a = l.tag;
    if (a === 5 || a === 6)
      ((l = l.stateNode),
        t
          ? (e.nodeType === 9
              ? e.body
              : e.nodeName === "HTML"
                ? e.ownerDocument.body
                : e
            ).insertBefore(l, t)
          : ((t =
              e.nodeType === 9
                ? e.body
                : e.nodeName === "HTML"
                  ? e.ownerDocument.body
                  : e),
            t.appendChild(l),
            (e = e._reactRootContainer),
            e != null || t.onclick !== null || (t.onclick = ge)));
    else if (
      a !== 4 &&
      (a === 27 && la(l.type) && ((e = l.stateNode), (t = null)),
      (l = l.child),
      l !== null)
    )
      for (lf(l, t, e), l = l.sibling; l !== null; )
        (lf(l, t, e), (l = l.sibling));
  }
  function ei(l, t, e) {
    var a = l.tag;
    if (a === 5 || a === 6)
      ((l = l.stateNode), t ? e.insertBefore(l, t) : e.appendChild(l));
    else if (
      a !== 4 &&
      (a === 27 && la(l.type) && (e = l.stateNode), (l = l.child), l !== null)
    )
      for (ei(l, t, e), l = l.sibling; l !== null; )
        (ei(l, t, e), (l = l.sibling));
  }
  function r0(l) {
    var t = l.stateNode,
      e = l.memoizedProps;
    try {
      for (var a = l.type, u = t.attributes; u.length; )
        t.removeAttributeNode(u[0]);
      (dt(t, a, e), (t[lt] = l), (t[ht] = e));
    } catch (n) {
      Al(l, l.return, n);
    }
  }
  var xe = !1,
    Il = !1,
    tf = !1,
    d0 = typeof WeakSet == "function" ? WeakSet : Set,
    nt = null;
  function eh(l, t) {
    if (((l = l.containerInfo), (Ef = Ei), (l = Ao(l)), ki(l))) {
      if ("selectionStart" in l)
        var e = { start: l.selectionStart, end: l.selectionEnd };
      else
        l: {
          e = ((e = l.ownerDocument) && e.defaultView) || window;
          var a = e.getSelection && e.getSelection();
          if (a && a.rangeCount !== 0) {
            e = a.anchorNode;
            var u = a.anchorOffset,
              n = a.focusNode;
            a = a.focusOffset;
            try {
              (e.nodeType, n.nodeType);
            } catch {
              e = null;
              break l;
            }
            var i = 0,
              c = -1,
              o = -1,
              g = 0,
              z = 0,
              M = l,
              v = null;
            t: for (;;) {
              for (
                var b;
                M !== e || (u !== 0 && M.nodeType !== 3) || (c = i + u),
                  M !== n || (a !== 0 && M.nodeType !== 3) || (o = i + a),
                  M.nodeType === 3 && (i += M.nodeValue.length),
                  (b = M.firstChild) !== null;
              )
                ((v = M), (M = b));
              for (;;) {
                if (M === l) break t;
                if (
                  (v === e && ++g === u && (c = i),
                  v === n && ++z === a && (o = i),
                  (b = M.nextSibling) !== null)
                )
                  break;
                ((M = v), (v = M.parentNode));
              }
              M = b;
            }
            e = c === -1 || o === -1 ? null : { start: c, end: o };
          } else e = null;
        }
      e = e || { start: 0, end: 0 };
    } else e = null;
    for (
      Af = { focusedElem: l, selectionRange: e }, Ei = !1, nt = t;
      nt !== null;
    )
      if (
        ((t = nt), (l = t.child), (t.subtreeFlags & 1028) !== 0 && l !== null)
      )
        ((l.return = t), (nt = l));
      else
        for (; nt !== null; ) {
          switch (((t = nt), (n = t.alternate), (l = t.flags), t.tag)) {
            case 0:
              if (
                (l & 4) !== 0 &&
                ((l = t.updateQueue),
                (l = l !== null ? l.events : null),
                l !== null)
              )
                for (e = 0; e < l.length; e++)
                  ((u = l[e]), (u.ref.impl = u.nextImpl));
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((l & 1024) !== 0 && n !== null) {
                ((l = void 0),
                  (e = t),
                  (u = n.memoizedProps),
                  (n = n.memoizedState),
                  (a = e.stateNode));
                try {
                  var X = xa(e.type, u);
                  ((l = a.getSnapshotBeforeUpdate(X, n)),
                    (a.__reactInternalSnapshotBeforeUpdate = l));
                } catch (w) {
                  Al(e, e.return, w);
                }
              }
              break;
            case 3:
              if ((l & 1024) !== 0) {
                if (
                  ((l = t.stateNode.containerInfo), (e = l.nodeType), e === 9)
                )
                  _f(l);
                else if (e === 1)
                  switch (l.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      _f(l);
                      break;
                    default:
                      l.textContent = "";
                  }
              }
              break;
            case 5:
            case 26:
            case 27:
            case 6:
            case 4:
            case 17:
              break;
            default:
              if ((l & 1024) !== 0) throw Error(h(163));
          }
          if (((l = t.sibling), l !== null)) {
            ((l.return = t.return), (nt = l));
            break;
          }
          nt = t.return;
        }
  }
  function h0(l, t, e) {
    var a = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        (Oe(l, e), a & 4 && Wu(5, e));
        break;
      case 1:
        if ((Oe(l, e), a & 4))
          if (((l = e.stateNode), t === null))
            try {
              l.componentDidMount();
            } catch (i) {
              Al(e, e.return, i);
            }
          else {
            var u = xa(e.type, t.memoizedProps);
            t = t.memoizedState;
            try {
              l.componentDidUpdate(u, t, l.__reactInternalSnapshotBeforeUpdate);
            } catch (i) {
              Al(e, e.return, i);
            }
          }
        (a & 64 && c0(e), a & 512 && $u(e, e.return));
        break;
      case 3:
        if ((Oe(l, e), a & 64 && ((l = e.updateQueue), l !== null))) {
          if (((t = null), e.child !== null))
            switch (e.child.tag) {
              case 27:
              case 5:
                t = e.child.stateNode;
                break;
              case 1:
                t = e.child.stateNode;
            }
          try {
            Fo(l, t);
          } catch (i) {
            Al(e, e.return, i);
          }
        }
        break;
      case 27:
        t === null && a & 4 && r0(e);
      case 26:
      case 5:
        (Oe(l, e), t === null && a & 4 && o0(e), a & 512 && $u(e, e.return));
        break;
      case 12:
        Oe(l, e);
        break;
      case 31:
        (Oe(l, e), a & 4 && g0(l, e));
        break;
      case 13:
        (Oe(l, e),
          a & 4 && v0(l, e),
          a & 64 &&
            ((l = e.memoizedState),
            l !== null &&
              ((l = l.dehydrated),
              l !== null && ((e = rh.bind(null, e)), Uh(l, e)))));
        break;
      case 22:
        if (((a = e.memoizedState !== null || xe), !a)) {
          ((t = (t !== null && t.memoizedState !== null) || Il), (u = xe));
          var n = Il;
          ((xe = a),
            (Il = t) && !n ? De(l, e, (e.subtreeFlags & 8772) !== 0) : Oe(l, e),
            (xe = u),
            (Il = n));
        }
        break;
      case 30:
        break;
      default:
        Oe(l, e);
    }
  }
  function y0(l) {
    var t = l.alternate;
    (t !== null && ((l.alternate = null), y0(t)),
      (l.child = null),
      (l.deletions = null),
      (l.sibling = null),
      l.tag === 5 && ((t = l.stateNode), t !== null && ct(t)),
      (l.stateNode = null),
      (l.return = null),
      (l.dependencies = null),
      (l.memoizedProps = null),
      (l.memoizedState = null),
      (l.pendingProps = null),
      (l.stateNode = null),
      (l.updateQueue = null));
  }
  var Xl = null,
    Tt = !1;
  function _e(l, t, e) {
    for (e = e.child; e !== null; ) (m0(l, t, e), (e = e.sibling));
  }
  function m0(l, t, e) {
    if (Ul && typeof Ul.onCommitFiberUnmount == "function")
      try {
        Ul.onCommitFiberUnmount(Be, e);
      } catch {}
    switch (e.tag) {
      case 26:
        (Il || oe(e, t),
          _e(l, t, e),
          e.memoizedState
            ? e.memoizedState.count--
            : e.stateNode && ((e = e.stateNode), e.parentNode.removeChild(e)));
        break;
      case 27:
        Il || oe(e, t);
        var a = Xl,
          u = Tt;
        (la(e.type) && ((Xl = e.stateNode), (Tt = !1)),
          _e(l, t, e),
          nn(e.stateNode),
          (Xl = a),
          (Tt = u));
        break;
      case 5:
        Il || oe(e, t);
      case 6:
        if (
          ((a = Xl),
          (u = Tt),
          (Xl = null),
          _e(l, t, e),
          (Xl = a),
          (Tt = u),
          Xl !== null)
        )
          if (Tt)
            try {
              (Xl.nodeType === 9
                ? Xl.body
                : Xl.nodeName === "HTML"
                  ? Xl.ownerDocument.body
                  : Xl
              ).removeChild(e.stateNode);
            } catch (n) {
              Al(e, t, n);
            }
          else
            try {
              Xl.removeChild(e.stateNode);
            } catch (n) {
              Al(e, t, n);
            }
        break;
      case 18:
        Xl !== null &&
          (Tt
            ? ((l = Xl),
              cr(
                l.nodeType === 9
                  ? l.body
                  : l.nodeName === "HTML"
                    ? l.ownerDocument.body
                    : l,
                e.stateNode,
              ),
              hu(l))
            : cr(Xl, e.stateNode));
        break;
      case 4:
        ((a = Xl),
          (u = Tt),
          (Xl = e.stateNode.containerInfo),
          (Tt = !0),
          _e(l, t, e),
          (Xl = a),
          (Tt = u));
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        (we(2, e, t), Il || we(4, e, t), _e(l, t, e));
        break;
      case 1:
        (Il ||
          (oe(e, t),
          (a = e.stateNode),
          typeof a.componentWillUnmount == "function" && f0(e, t, a)),
          _e(l, t, e));
        break;
      case 21:
        _e(l, t, e);
        break;
      case 22:
        ((Il = (a = Il) || e.memoizedState !== null), _e(l, t, e), (Il = a));
        break;
      default:
        _e(l, t, e);
    }
  }
  function g0(l, t) {
    if (
      t.memoizedState === null &&
      ((l = t.alternate), l !== null && ((l = l.memoizedState), l !== null))
    ) {
      l = l.dehydrated;
      try {
        hu(l);
      } catch (e) {
        Al(t, t.return, e);
      }
    }
  }
  function v0(l, t) {
    if (
      t.memoizedState === null &&
      ((l = t.alternate),
      l !== null &&
        ((l = l.memoizedState), l !== null && ((l = l.dehydrated), l !== null)))
    )
      try {
        hu(l);
      } catch (e) {
        Al(t, t.return, e);
      }
  }
  function ah(l) {
    switch (l.tag) {
      case 31:
      case 13:
      case 19:
        var t = l.stateNode;
        return (t === null && (t = l.stateNode = new d0()), t);
      case 22:
        return (
          (l = l.stateNode),
          (t = l._retryCache),
          t === null && (t = l._retryCache = new d0()),
          t
        );
      default:
        throw Error(h(435, l.tag));
    }
  }
  function ai(l, t) {
    var e = ah(l);
    t.forEach(function (a) {
      if (!e.has(a)) {
        e.add(a);
        var u = dh.bind(null, l, a);
        a.then(u, u);
      }
    });
  }
  function zt(l, t) {
    var e = t.deletions;
    if (e !== null)
      for (var a = 0; a < e.length; a++) {
        var u = e[a],
          n = l,
          i = t,
          c = i;
        l: for (; c !== null; ) {
          switch (c.tag) {
            case 27:
              if (la(c.type)) {
                ((Xl = c.stateNode), (Tt = !1));
                break l;
              }
              break;
            case 5:
              ((Xl = c.stateNode), (Tt = !1));
              break l;
            case 3:
            case 4:
              ((Xl = c.stateNode.containerInfo), (Tt = !0));
              break l;
          }
          c = c.return;
        }
        if (Xl === null) throw Error(h(160));
        (m0(n, i, u),
          (Xl = null),
          (Tt = !1),
          (n = u.alternate),
          n !== null && (n.return = null),
          (u.return = null));
      }
    if (t.subtreeFlags & 13886)
      for (t = t.child; t !== null; ) (S0(t, l), (t = t.sibling));
  }
  var le = null;
  function S0(l, t) {
    var e = l.alternate,
      a = l.flags;
    switch (l.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        (zt(t, l),
          Et(l),
          a & 4 && (we(3, l, l.return), Wu(3, l), we(5, l, l.return)));
        break;
      case 1:
        (zt(t, l),
          Et(l),
          a & 512 && (Il || e === null || oe(e, e.return)),
          a & 64 &&
            xe &&
            ((l = l.updateQueue),
            l !== null &&
              ((a = l.callbacks),
              a !== null &&
                ((e = l.shared.hiddenCallbacks),
                (l.shared.hiddenCallbacks = e === null ? a : e.concat(a))))));
        break;
      case 26:
        var u = le;
        if (
          (zt(t, l),
          Et(l),
          a & 512 && (Il || e === null || oe(e, e.return)),
          a & 4)
        ) {
          var n = e !== null ? e.memoizedState : null;
          if (((a = l.memoizedState), e === null))
            if (a === null)
              if (l.stateNode === null) {
                l: {
                  ((a = l.type),
                    (e = l.memoizedProps),
                    (u = u.ownerDocument || u));
                  t: switch (a) {
                    case "title":
                      ((n = u.getElementsByTagName("title")[0]),
                        (!n ||
                          n[Jl] ||
                          n[lt] ||
                          n.namespaceURI === "http://www.w3.org/2000/svg" ||
                          n.hasAttribute("itemprop")) &&
                          ((n = u.createElement(a)),
                          u.head.insertBefore(
                            n,
                            u.querySelector("head > title"),
                          )),
                        dt(n, a, e),
                        (n[lt] = l),
                        nl(n),
                        (a = n));
                      break l;
                    case "link":
                      var i = Sr("link", "href", u).get(a + (e.href || ""));
                      if (i) {
                        for (var c = 0; c < i.length; c++)
                          if (
                            ((n = i[c]),
                            n.getAttribute("href") ===
                              (e.href == null || e.href === ""
                                ? null
                                : e.href) &&
                              n.getAttribute("rel") ===
                                (e.rel == null ? null : e.rel) &&
                              n.getAttribute("title") ===
                                (e.title == null ? null : e.title) &&
                              n.getAttribute("crossorigin") ===
                                (e.crossOrigin == null ? null : e.crossOrigin))
                          ) {
                            i.splice(c, 1);
                            break t;
                          }
                      }
                      ((n = u.createElement(a)),
                        dt(n, a, e),
                        u.head.appendChild(n));
                      break;
                    case "meta":
                      if (
                        (i = Sr("meta", "content", u).get(
                          a + (e.content || ""),
                        ))
                      ) {
                        for (c = 0; c < i.length; c++)
                          if (
                            ((n = i[c]),
                            n.getAttribute("content") ===
                              (e.content == null ? null : "" + e.content) &&
                              n.getAttribute("name") ===
                                (e.name == null ? null : e.name) &&
                              n.getAttribute("property") ===
                                (e.property == null ? null : e.property) &&
                              n.getAttribute("http-equiv") ===
                                (e.httpEquiv == null ? null : e.httpEquiv) &&
                              n.getAttribute("charset") ===
                                (e.charSet == null ? null : e.charSet))
                          ) {
                            i.splice(c, 1);
                            break t;
                          }
                      }
                      ((n = u.createElement(a)),
                        dt(n, a, e),
                        u.head.appendChild(n));
                      break;
                    default:
                      throw Error(h(468, a));
                  }
                  ((n[lt] = l), nl(n), (a = n));
                }
                l.stateNode = a;
              } else br(u, l.type, l.stateNode);
            else l.stateNode = vr(u, a, l.memoizedProps);
          else
            n !== a
              ? (n === null
                  ? e.stateNode !== null &&
                    ((e = e.stateNode), e.parentNode.removeChild(e))
                  : n.count--,
                a === null
                  ? br(u, l.type, l.stateNode)
                  : vr(u, a, l.memoizedProps))
              : a === null &&
                l.stateNode !== null &&
                Ic(l, l.memoizedProps, e.memoizedProps);
        }
        break;
      case 27:
        (zt(t, l),
          Et(l),
          a & 512 && (Il || e === null || oe(e, e.return)),
          e !== null && a & 4 && Ic(l, l.memoizedProps, e.memoizedProps));
        break;
      case 5:
        if (
          (zt(t, l),
          Et(l),
          a & 512 && (Il || e === null || oe(e, e.return)),
          l.flags & 32)
        ) {
          u = l.stateNode;
          try {
            Na(u, "");
          } catch (X) {
            Al(l, l.return, X);
          }
        }
        (a & 4 &&
          l.stateNode != null &&
          ((u = l.memoizedProps), Ic(l, u, e !== null ? e.memoizedProps : u)),
          a & 1024 && (tf = !0));
        break;
      case 6:
        if ((zt(t, l), Et(l), a & 4)) {
          if (l.stateNode === null) throw Error(h(162));
          ((a = l.memoizedProps), (e = l.stateNode));
          try {
            e.nodeValue = a;
          } catch (X) {
            Al(l, l.return, X);
          }
        }
        break;
      case 3:
        if (
          ((bi = null),
          (u = le),
          (le = vi(t.containerInfo)),
          zt(t, l),
          (le = u),
          Et(l),
          a & 4 && e !== null && e.memoizedState.isDehydrated)
        )
          try {
            hu(t.containerInfo);
          } catch (X) {
            Al(l, l.return, X);
          }
        tf && ((tf = !1), b0(l));
        break;
      case 4:
        ((a = le),
          (le = vi(l.stateNode.containerInfo)),
          zt(t, l),
          Et(l),
          (le = a));
        break;
      case 12:
        (zt(t, l), Et(l));
        break;
      case 31:
        (zt(t, l),
          Et(l),
          a & 4 &&
            ((a = l.updateQueue),
            a !== null && ((l.updateQueue = null), ai(l, a))));
        break;
      case 13:
        (zt(t, l),
          Et(l),
          l.child.flags & 8192 &&
            (l.memoizedState !== null) !=
              (e !== null && e.memoizedState !== null) &&
            (ni = vl()),
          a & 4 &&
            ((a = l.updateQueue),
            a !== null && ((l.updateQueue = null), ai(l, a))));
        break;
      case 22:
        u = l.memoizedState !== null;
        var o = e !== null && e.memoizedState !== null,
          g = xe,
          z = Il;
        if (
          ((xe = g || u),
          (Il = z || o),
          zt(t, l),
          (Il = z),
          (xe = g),
          Et(l),
          a & 8192)
        )
          l: for (
            t = l.stateNode,
              t._visibility = u ? t._visibility & -2 : t._visibility | 1,
              u && (e === null || o || xe || Il || _a(l)),
              e = null,
              t = l;
            ;
          ) {
            if (t.tag === 5 || t.tag === 26) {
              if (e === null) {
                o = e = t;
                try {
                  if (((n = o.stateNode), u))
                    ((i = n.style),
                      typeof i.setProperty == "function"
                        ? i.setProperty("display", "none", "important")
                        : (i.display = "none"));
                  else {
                    c = o.stateNode;
                    var M = o.memoizedProps.style,
                      v =
                        M != null && M.hasOwnProperty("display")
                          ? M.display
                          : null;
                    c.style.display =
                      v == null || typeof v == "boolean" ? "" : ("" + v).trim();
                  }
                } catch (X) {
                  Al(o, o.return, X);
                }
              }
            } else if (t.tag === 6) {
              if (e === null) {
                o = t;
                try {
                  o.stateNode.nodeValue = u ? "" : o.memoizedProps;
                } catch (X) {
                  Al(o, o.return, X);
                }
              }
            } else if (t.tag === 18) {
              if (e === null) {
                o = t;
                try {
                  var b = o.stateNode;
                  u ? fr(b, !0) : fr(o.stateNode, !1);
                } catch (X) {
                  Al(o, o.return, X);
                }
              }
            } else if (
              ((t.tag !== 22 && t.tag !== 23) ||
                t.memoizedState === null ||
                t === l) &&
              t.child !== null
            ) {
              ((t.child.return = t), (t = t.child));
              continue;
            }
            if (t === l) break l;
            for (; t.sibling === null; ) {
              if (t.return === null || t.return === l) break l;
              (e === t && (e = null), (t = t.return));
            }
            (e === t && (e = null),
              (t.sibling.return = t.return),
              (t = t.sibling));
          }
        a & 4 &&
          ((a = l.updateQueue),
          a !== null &&
            ((e = a.retryQueue),
            e !== null && ((a.retryQueue = null), ai(l, e))));
        break;
      case 19:
        (zt(t, l),
          Et(l),
          a & 4 &&
            ((a = l.updateQueue),
            a !== null && ((l.updateQueue = null), ai(l, a))));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        (zt(t, l), Et(l));
    }
  }
  function Et(l) {
    var t = l.flags;
    if (t & 2) {
      try {
        for (var e, a = l.return; a !== null; ) {
          if (s0(a)) {
            e = a;
            break;
          }
          a = a.return;
        }
        if (e == null) throw Error(h(160));
        switch (e.tag) {
          case 27:
            var u = e.stateNode,
              n = Pc(l);
            ei(l, n, u);
            break;
          case 5:
            var i = e.stateNode;
            e.flags & 32 && (Na(i, ""), (e.flags &= -33));
            var c = Pc(l);
            ei(l, c, i);
            break;
          case 3:
          case 4:
            var o = e.stateNode.containerInfo,
              g = Pc(l);
            lf(l, g, o);
            break;
          default:
            throw Error(h(161));
        }
      } catch (z) {
        Al(l, l.return, z);
      }
      l.flags &= -3;
    }
    t & 4096 && (l.flags &= -4097);
  }
  function b0(l) {
    if (l.subtreeFlags & 1024)
      for (l = l.child; l !== null; ) {
        var t = l;
        (b0(t),
          t.tag === 5 && t.flags & 1024 && t.stateNode.reset(),
          (l = l.sibling));
      }
  }
  function Oe(l, t) {
    if (t.subtreeFlags & 8772)
      for (t = t.child; t !== null; ) (h0(l, t.alternate, t), (t = t.sibling));
  }
  function _a(l) {
    for (l = l.child; l !== null; ) {
      var t = l;
      switch (t.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          (we(4, t, t.return), _a(t));
          break;
        case 1:
          oe(t, t.return);
          var e = t.stateNode;
          (typeof e.componentWillUnmount == "function" && f0(t, t.return, e),
            _a(t));
          break;
        case 27:
          nn(t.stateNode);
        case 26:
        case 5:
          (oe(t, t.return), _a(t));
          break;
        case 22:
          t.memoizedState === null && _a(t);
          break;
        case 30:
          _a(t);
          break;
        default:
          _a(t);
      }
      l = l.sibling;
    }
  }
  function De(l, t, e) {
    for (e = e && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; ) {
      var a = t.alternate,
        u = l,
        n = t,
        i = n.flags;
      switch (n.tag) {
        case 0:
        case 11:
        case 15:
          (De(u, n, e), Wu(4, n));
          break;
        case 1:
          if (
            (De(u, n, e),
            (a = n),
            (u = a.stateNode),
            typeof u.componentDidMount == "function")
          )
            try {
              u.componentDidMount();
            } catch (g) {
              Al(a, a.return, g);
            }
          if (((a = n), (u = a.updateQueue), u !== null)) {
            var c = a.stateNode;
            try {
              var o = u.shared.hiddenCallbacks;
              if (o !== null)
                for (u.shared.hiddenCallbacks = null, u = 0; u < o.length; u++)
                  $o(o[u], c);
            } catch (g) {
              Al(a, a.return, g);
            }
          }
          (e && i & 64 && c0(n), $u(n, n.return));
          break;
        case 27:
          r0(n);
        case 26:
        case 5:
          (De(u, n, e), e && a === null && i & 4 && o0(n), $u(n, n.return));
          break;
        case 12:
          De(u, n, e);
          break;
        case 31:
          (De(u, n, e), e && i & 4 && g0(u, n));
          break;
        case 13:
          (De(u, n, e), e && i & 4 && v0(u, n));
          break;
        case 22:
          (n.memoizedState === null && De(u, n, e), $u(n, n.return));
          break;
        case 30:
          break;
        default:
          De(u, n, e);
      }
      t = t.sibling;
    }
  }
  function ef(l, t) {
    var e = null;
    (l !== null &&
      l.memoizedState !== null &&
      l.memoizedState.cachePool !== null &&
      (e = l.memoizedState.cachePool.pool),
      (l = null),
      t.memoizedState !== null &&
        t.memoizedState.cachePool !== null &&
        (l = t.memoizedState.cachePool.pool),
      l !== e && (l != null && l.refCount++, e != null && Nu(e)));
  }
  function af(l, t) {
    ((l = null),
      t.alternate !== null && (l = t.alternate.memoizedState.cache),
      (t = t.memoizedState.cache),
      t !== l && (t.refCount++, l != null && Nu(l)));
  }
  function te(l, t, e, a) {
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; ) (p0(l, t, e, a), (t = t.sibling));
  }
  function p0(l, t, e, a) {
    var u = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        (te(l, t, e, a), u & 2048 && Wu(9, t));
        break;
      case 1:
        te(l, t, e, a);
        break;
      case 3:
        (te(l, t, e, a),
          u & 2048 &&
            ((l = null),
            t.alternate !== null && (l = t.alternate.memoizedState.cache),
            (t = t.memoizedState.cache),
            t !== l && (t.refCount++, l != null && Nu(l))));
        break;
      case 12:
        if (u & 2048) {
          (te(l, t, e, a), (l = t.stateNode));
          try {
            var n = t.memoizedProps,
              i = n.id,
              c = n.onPostCommit;
            typeof c == "function" &&
              c(
                i,
                t.alternate === null ? "mount" : "update",
                l.passiveEffectDuration,
                -0,
              );
          } catch (o) {
            Al(t, t.return, o);
          }
        } else te(l, t, e, a);
        break;
      case 31:
        te(l, t, e, a);
        break;
      case 13:
        te(l, t, e, a);
        break;
      case 23:
        break;
      case 22:
        ((n = t.stateNode),
          (i = t.alternate),
          t.memoizedState !== null
            ? n._visibility & 2
              ? te(l, t, e, a)
              : Fu(l, t)
            : n._visibility & 2
              ? te(l, t, e, a)
              : ((n._visibility |= 2),
                eu(l, t, e, a, (t.subtreeFlags & 10256) !== 0 || !1)),
          u & 2048 && ef(i, t));
        break;
      case 24:
        (te(l, t, e, a), u & 2048 && af(t.alternate, t));
        break;
      default:
        te(l, t, e, a);
    }
  }
  function eu(l, t, e, a, u) {
    for (
      u = u && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child;
      t !== null;
    ) {
      var n = l,
        i = t,
        c = e,
        o = a,
        g = i.flags;
      switch (i.tag) {
        case 0:
        case 11:
        case 15:
          (eu(n, i, c, o, u), Wu(8, i));
          break;
        case 23:
          break;
        case 22:
          var z = i.stateNode;
          (i.memoizedState !== null
            ? z._visibility & 2
              ? eu(n, i, c, o, u)
              : Fu(n, i)
            : ((z._visibility |= 2), eu(n, i, c, o, u)),
            u && g & 2048 && ef(i.alternate, i));
          break;
        case 24:
          (eu(n, i, c, o, u), u && g & 2048 && af(i.alternate, i));
          break;
        default:
          eu(n, i, c, o, u);
      }
      t = t.sibling;
    }
  }
  function Fu(l, t) {
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; ) {
        var e = l,
          a = t,
          u = a.flags;
        switch (a.tag) {
          case 22:
            (Fu(e, a), u & 2048 && ef(a.alternate, a));
            break;
          case 24:
            (Fu(e, a), u & 2048 && af(a.alternate, a));
            break;
          default:
            Fu(e, a);
        }
        t = t.sibling;
      }
  }
  var Iu = 8192;
  function au(l, t, e) {
    if (l.subtreeFlags & Iu)
      for (l = l.child; l !== null; ) (T0(l, t, e), (l = l.sibling));
  }
  function T0(l, t, e) {
    switch (l.tag) {
      case 26:
        (au(l, t, e),
          l.flags & Iu &&
            l.memoizedState !== null &&
            Zh(e, le, l.memoizedState, l.memoizedProps));
        break;
      case 5:
        au(l, t, e);
        break;
      case 3:
      case 4:
        var a = le;
        ((le = vi(l.stateNode.containerInfo)), au(l, t, e), (le = a));
        break;
      case 22:
        l.memoizedState === null &&
          ((a = l.alternate),
          a !== null && a.memoizedState !== null
            ? ((a = Iu), (Iu = 16777216), au(l, t, e), (Iu = a))
            : au(l, t, e));
        break;
      default:
        au(l, t, e);
    }
  }
  function z0(l) {
    var t = l.alternate;
    if (t !== null && ((l = t.child), l !== null)) {
      t.child = null;
      do ((t = l.sibling), (l.sibling = null), (l = t));
      while (l !== null);
    }
  }
  function Pu(l) {
    var t = l.deletions;
    if ((l.flags & 16) !== 0) {
      if (t !== null)
        for (var e = 0; e < t.length; e++) {
          var a = t[e];
          ((nt = a), A0(a, l));
        }
      z0(l);
    }
    if (l.subtreeFlags & 10256)
      for (l = l.child; l !== null; ) (E0(l), (l = l.sibling));
  }
  function E0(l) {
    switch (l.tag) {
      case 0:
      case 11:
      case 15:
        (Pu(l), l.flags & 2048 && we(9, l, l.return));
        break;
      case 3:
        Pu(l);
        break;
      case 12:
        Pu(l);
        break;
      case 22:
        var t = l.stateNode;
        l.memoizedState !== null &&
        t._visibility & 2 &&
        (l.return === null || l.return.tag !== 13)
          ? ((t._visibility &= -3), ui(l))
          : Pu(l);
        break;
      default:
        Pu(l);
    }
  }
  function ui(l) {
    var t = l.deletions;
    if ((l.flags & 16) !== 0) {
      if (t !== null)
        for (var e = 0; e < t.length; e++) {
          var a = t[e];
          ((nt = a), A0(a, l));
        }
      z0(l);
    }
    for (l = l.child; l !== null; ) {
      switch (((t = l), t.tag)) {
        case 0:
        case 11:
        case 15:
          (we(8, t, t.return), ui(t));
          break;
        case 22:
          ((e = t.stateNode),
            e._visibility & 2 && ((e._visibility &= -3), ui(t)));
          break;
        default:
          ui(t);
      }
      l = l.sibling;
    }
  }
  function A0(l, t) {
    for (; nt !== null; ) {
      var e = nt;
      switch (e.tag) {
        case 0:
        case 11:
        case 15:
          we(8, e, t);
          break;
        case 23:
        case 22:
          if (e.memoizedState !== null && e.memoizedState.cachePool !== null) {
            var a = e.memoizedState.cachePool.pool;
            a != null && a.refCount++;
          }
          break;
        case 24:
          Nu(e.memoizedState.cache);
      }
      if (((a = e.child), a !== null)) ((a.return = e), (nt = a));
      else
        l: for (e = l; nt !== null; ) {
          a = nt;
          var u = a.sibling,
            n = a.return;
          if ((y0(a), a === e)) {
            nt = null;
            break l;
          }
          if (u !== null) {
            ((u.return = n), (nt = u));
            break l;
          }
          nt = n;
        }
    }
  }
  var uh = {
      getCacheForType: function (l) {
        var t = st(Wl),
          e = t.data.get(l);
        return (e === void 0 && ((e = l()), t.data.set(l, e)), e);
      },
      cacheSignal: function () {
        return st(Wl).controller.signal;
      },
    },
    nh = typeof WeakMap == "function" ? WeakMap : Map,
    Sl = 0,
    jl = null,
    il = null,
    sl = 0,
    El = 0,
    Ut = null,
    ke = !1,
    uu = !1,
    uf = !1,
    Re = 0,
    Ll = 0,
    We = 0,
    Oa = 0,
    nf = 0,
    jt = 0,
    nu = 0,
    ln = null,
    At = null,
    cf = !1,
    ni = 0,
    M0 = 0,
    ii = 1 / 0,
    ci = null,
    $e = null,
    et = 0,
    Fe = null,
    iu = null,
    Ue = 0,
    ff = 0,
    of = null,
    x0 = null,
    tn = 0,
    sf = null;
  function Ct() {
    return (Sl & 2) !== 0 && sl !== 0 ? sl & -sl : T.T !== null ? gf() : he();
  }
  function _0() {
    if (jt === 0)
      if ((sl & 536870912) === 0 || hl) {
        var l = kt;
        ((kt <<= 1), (kt & 3932160) === 0 && (kt = 262144), (jt = l));
      } else jt = 536870912;
    return ((l = Dt.current), l !== null && (l.flags |= 32), jt);
  }
  function Mt(l, t, e) {
    (((l === jl && (El === 2 || El === 9)) || l.cancelPendingCommit !== null) &&
      (cu(l, 0), Ie(l, sl, jt, !1)),
      Wt(l, e),
      ((Sl & 2) === 0 || l !== jl) &&
        (l === jl &&
          ((Sl & 2) === 0 && (Oa |= e), Ll === 4 && Ie(l, sl, jt, !1)),
        se(l)));
  }
  function O0(l, t, e) {
    if ((Sl & 6) !== 0) throw Error(h(327));
    var a = (!e && (t & 127) === 0 && (t & l.expiredLanes) === 0) || ra(l, t),
      u = a ? fh(l, t) : df(l, t, !0),
      n = a;
    do {
      if (u === 0) {
        uu && !a && Ie(l, t, 0, !1);
        break;
      } else {
        if (((e = l.current.alternate), n && !ih(e))) {
          ((u = df(l, t, !1)), (n = !1));
          continue;
        }
        if (u === 2) {
          if (((n = t), l.errorRecoveryDisabledLanes & n)) var i = 0;
          else
            ((i = l.pendingLanes & -536870913),
              (i = i !== 0 ? i : i & 536870912 ? 536870912 : 0));
          if (i !== 0) {
            t = i;
            l: {
              var c = l;
              u = ln;
              var o = c.current.memoizedState.isDehydrated;
              if ((o && (cu(c, i).flags |= 256), (i = df(c, i, !1)), i !== 2)) {
                if (uf && !o) {
                  ((c.errorRecoveryDisabledLanes |= n), (Oa |= n), (u = 4));
                  break l;
                }
                ((n = At),
                  (At = u),
                  n !== null &&
                    (At === null ? (At = n) : At.push.apply(At, n)));
              }
              u = i;
            }
            if (((n = !1), u !== 2)) continue;
          }
        }
        if (u === 1) {
          (cu(l, 0), Ie(l, t, 0, !0));
          break;
        }
        l: {
          switch (((a = l), (n = u), n)) {
            case 0:
            case 1:
              throw Error(h(345));
            case 4:
              if ((t & 4194048) !== t) break;
            case 6:
              Ie(a, t, jt, !ke);
              break l;
            case 2:
              At = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(h(329));
          }
          if ((t & 62914560) === t && ((u = ni + 300 - vl()), 10 < u)) {
            if ((Ie(a, t, jt, !ke), Ca(a, 0, !0) !== 0)) break l;
            ((Ue = t),
              (a.timeoutHandle = nr(
                D0.bind(
                  null,
                  a,
                  e,
                  At,
                  ci,
                  cf,
                  t,
                  jt,
                  Oa,
                  nu,
                  ke,
                  n,
                  "Throttled",
                  -0,
                  0,
                ),
                u,
              )));
            break l;
          }
          D0(a, e, At, ci, cf, t, jt, Oa, nu, ke, n, null, -0, 0);
        }
      }
      break;
    } while (!0);
    se(l);
  }
  function D0(l, t, e, a, u, n, i, c, o, g, z, M, v, b) {
    if (
      ((l.timeoutHandle = -1),
      (M = t.subtreeFlags),
      M & 8192 || (M & 16785408) === 16785408)
    ) {
      ((M = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: ge,
      }),
        T0(t, n, M));
      var X =
        (n & 62914560) === n ? ni - vl() : (n & 4194048) === n ? M0 - vl() : 0;
      if (((X = Vh(M, X)), X !== null)) {
        ((Ue = n),
          (l.cancelPendingCommit = X(
            Y0.bind(null, l, t, n, e, a, u, i, c, o, z, M, null, v, b),
          )),
          Ie(l, n, i, !g));
        return;
      }
    }
    Y0(l, t, n, e, a, u, i, c, o);
  }
  function ih(l) {
    for (var t = l; ; ) {
      var e = t.tag;
      if (
        (e === 0 || e === 11 || e === 15) &&
        t.flags & 16384 &&
        ((e = t.updateQueue), e !== null && ((e = e.stores), e !== null))
      )
        for (var a = 0; a < e.length; a++) {
          var u = e[a],
            n = u.getSnapshot;
          u = u.value;
          try {
            if (!_t(n(), u)) return !1;
          } catch {
            return !1;
          }
        }
      if (((e = t.child), t.subtreeFlags & 16384 && e !== null))
        ((e.return = t), (t = e));
      else {
        if (t === l) break;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === l) return !0;
          t = t.return;
        }
        ((t.sibling.return = t.return), (t = t.sibling));
      }
    }
    return !0;
  }
  function Ie(l, t, e, a) {
    ((t &= ~nf),
      (t &= ~Oa),
      (l.suspendedLanes |= t),
      (l.pingedLanes &= ~t),
      a && (l.warmLanes |= t),
      (a = l.expirationTimes));
    for (var u = t; 0 < u; ) {
      var n = 31 - mt(u),
        i = 1 << n;
      ((a[n] = -1), (u &= ~i));
    }
    e !== 0 && Bl(l, e, t);
  }
  function fi() {
    return (Sl & 6) === 0 ? (en(0), !1) : !0;
  }
  function rf() {
    if (il !== null) {
      if (El === 0) var l = il.return;
      else ((l = il), (pe = ba = null), xc(l), (Fa = null), (qu = 0), (l = il));
      for (; l !== null; ) (i0(l.alternate, l), (l = l.return));
      il = null;
    }
  }
  function cu(l, t) {
    var e = l.timeoutHandle;
    (e !== -1 && ((l.timeoutHandle = -1), xh(e)),
      (e = l.cancelPendingCommit),
      e !== null && ((l.cancelPendingCommit = null), e()),
      (Ue = 0),
      rf(),
      (jl = l),
      (il = e = Se(l.current, null)),
      (sl = t),
      (El = 0),
      (Ut = null),
      (ke = !1),
      (uu = ra(l, t)),
      (uf = !1),
      (nu = jt = nf = Oa = We = Ll = 0),
      (At = ln = null),
      (cf = !1),
      (t & 8) !== 0 && (t |= t & 32));
    var a = l.entangledLanes;
    if (a !== 0)
      for (l = l.entanglements, a &= t; 0 < a; ) {
        var u = 31 - mt(a),
          n = 1 << u;
        ((t |= l[u]), (a &= ~n));
      }
    return ((Re = t), Dn(), e);
  }
  function R0(l, t) {
    ((tl = null),
      (T.H = Ku),
      t === $a || t === Yn
        ? ((t = Ko()), (El = 3))
        : t === yc
          ? ((t = Ko()), (El = 4))
          : (El =
              t === Lc
                ? 8
                : t !== null &&
                    typeof t == "object" &&
                    typeof t.then == "function"
                  ? 6
                  : 1),
      (Ut = t),
      il === null && ((Ll = 1), Fn(l, Gt(t, l.current))));
  }
  function U0() {
    var l = Dt.current;
    return l === null
      ? !0
      : (sl & 4194048) === sl
        ? Vt === null
        : (sl & 62914560) === sl || (sl & 536870912) !== 0
          ? l === Vt
          : !1;
  }
  function j0() {
    var l = T.H;
    return ((T.H = Ku), l === null ? Ku : l);
  }
  function C0() {
    var l = T.A;
    return ((T.A = uh), l);
  }
  function oi() {
    ((Ll = 4),
      ke || ((sl & 4194048) !== sl && Dt.current !== null) || (uu = !0),
      ((We & 134217727) === 0 && (Oa & 134217727) === 0) ||
        jl === null ||
        Ie(jl, sl, jt, !1));
  }
  function df(l, t, e) {
    var a = Sl;
    Sl |= 2;
    var u = j0(),
      n = C0();
    ((jl !== l || sl !== t) && ((ci = null), cu(l, t)), (t = !1));
    var i = Ll;
    l: do
      try {
        if (El !== 0 && il !== null) {
          var c = il,
            o = Ut;
          switch (El) {
            case 8:
              (rf(), (i = 6));
              break l;
            case 3:
            case 2:
            case 9:
            case 6:
              Dt.current === null && (t = !0);
              var g = El;
              if (((El = 0), (Ut = null), fu(l, c, o, g), e && uu)) {
                i = 0;
                break l;
              }
              break;
            default:
              ((g = El), (El = 0), (Ut = null), fu(l, c, o, g));
          }
        }
        (ch(), (i = Ll));
        break;
      } catch (z) {
        R0(l, z);
      }
    while (!0);
    return (
      t && l.shellSuspendCounter++,
      (pe = ba = null),
      (Sl = a),
      (T.H = u),
      (T.A = n),
      il === null && ((jl = null), (sl = 0), Dn()),
      i
    );
  }
  function ch() {
    for (; il !== null; ) H0(il);
  }
  function fh(l, t) {
    var e = Sl;
    Sl |= 2;
    var a = j0(),
      u = C0();
    jl !== l || sl !== t
      ? ((ci = null), (ii = vl() + 500), cu(l, t))
      : (uu = ra(l, t));
    l: do
      try {
        if (El !== 0 && il !== null) {
          t = il;
          var n = Ut;
          t: switch (El) {
            case 1:
              ((El = 0), (Ut = null), fu(l, t, n, 1));
              break;
            case 2:
            case 9:
              if (Vo(n)) {
                ((El = 0), (Ut = null), B0(t));
                break;
              }
              ((t = function () {
                ((El !== 2 && El !== 9) || jl !== l || (El = 7), se(l));
              }),
                n.then(t, t));
              break l;
            case 3:
              El = 7;
              break l;
            case 4:
              El = 5;
              break l;
            case 7:
              Vo(n)
                ? ((El = 0), (Ut = null), B0(t))
                : ((El = 0), (Ut = null), fu(l, t, n, 7));
              break;
            case 5:
              var i = null;
              switch (il.tag) {
                case 26:
                  i = il.memoizedState;
                case 5:
                case 27:
                  var c = il;
                  if (i ? pr(i) : c.stateNode.complete) {
                    ((El = 0), (Ut = null));
                    var o = c.sibling;
                    if (o !== null) il = o;
                    else {
                      var g = c.return;
                      g !== null ? ((il = g), si(g)) : (il = null);
                    }
                    break t;
                  }
              }
              ((El = 0), (Ut = null), fu(l, t, n, 5));
              break;
            case 6:
              ((El = 0), (Ut = null), fu(l, t, n, 6));
              break;
            case 8:
              (rf(), (Ll = 6));
              break l;
            default:
              throw Error(h(462));
          }
        }
        oh();
        break;
      } catch (z) {
        R0(l, z);
      }
    while (!0);
    return (
      (pe = ba = null),
      (T.H = a),
      (T.A = u),
      (Sl = e),
      il !== null ? 0 : ((jl = null), (sl = 0), Dn(), Ll)
    );
  }
  function oh() {
    for (; il !== null && !Ri(); ) H0(il);
  }
  function H0(l) {
    var t = u0(l.alternate, l, Re);
    ((l.memoizedProps = l.pendingProps), t === null ? si(l) : (il = t));
  }
  function B0(l) {
    var t = l,
      e = t.alternate;
    switch (t.tag) {
      case 15:
      case 0:
        t = Is(e, t, t.pendingProps, t.type, void 0, sl);
        break;
      case 11:
        t = Is(e, t, t.pendingProps, t.type.render, t.ref, sl);
        break;
      case 5:
        xc(t);
      default:
        (i0(e, t), (t = il = Co(t, Re)), (t = u0(e, t, Re)));
    }
    ((l.memoizedProps = l.pendingProps), t === null ? si(l) : (il = t));
  }
  function fu(l, t, e, a) {
    ((pe = ba = null), xc(t), (Fa = null), (qu = 0));
    var u = t.return;
    try {
      if (Fd(l, u, t, e, sl)) {
        ((Ll = 1), Fn(l, Gt(e, l.current)), (il = null));
        return;
      }
    } catch (n) {
      if (u !== null) throw ((il = u), n);
      ((Ll = 1), Fn(l, Gt(e, l.current)), (il = null));
      return;
    }
    t.flags & 32768
      ? (hl || a === 1
          ? (l = !0)
          : uu || (sl & 536870912) !== 0
            ? (l = !1)
            : ((ke = l = !0),
              (a === 2 || a === 9 || a === 3 || a === 6) &&
                ((a = Dt.current),
                a !== null && a.tag === 13 && (a.flags |= 16384))),
        N0(t, l))
      : si(t);
  }
  function si(l) {
    var t = l;
    do {
      if ((t.flags & 32768) !== 0) {
        N0(t, ke);
        return;
      }
      l = t.return;
      var e = lh(t.alternate, t, Re);
      if (e !== null) {
        il = e;
        return;
      }
      if (((t = t.sibling), t !== null)) {
        il = t;
        return;
      }
      il = t = l;
    } while (t !== null);
    Ll === 0 && (Ll = 5);
  }
  function N0(l, t) {
    do {
      var e = th(l.alternate, l);
      if (e !== null) {
        ((e.flags &= 32767), (il = e));
        return;
      }
      if (
        ((e = l.return),
        e !== null &&
          ((e.flags |= 32768), (e.subtreeFlags = 0), (e.deletions = null)),
        !t && ((l = l.sibling), l !== null))
      ) {
        il = l;
        return;
      }
      il = l = e;
    } while (l !== null);
    ((Ll = 6), (il = null));
  }
  function Y0(l, t, e, a, u, n, i, c, o) {
    l.cancelPendingCommit = null;
    do ri();
    while (et !== 0);
    if ((Sl & 6) !== 0) throw Error(h(327));
    if (t !== null) {
      if (t === l.current) throw Error(h(177));
      if (
        ((n = t.lanes | t.childLanes),
        (n |= Pi),
        da(l, e, n, i, c, o),
        l === jl && ((il = jl = null), (sl = 0)),
        (iu = t),
        (Fe = l),
        (Ue = e),
        (ff = n),
        (of = u),
        (x0 = a),
        (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0
          ? ((l.callbackNode = null),
            (l.callbackPriority = 0),
            hh(oa, function () {
              return (L0(), null);
            }))
          : ((l.callbackNode = null), (l.callbackPriority = 0)),
        (a = (t.flags & 13878) !== 0),
        (t.subtreeFlags & 13878) !== 0 || a)
      ) {
        ((a = T.T), (T.T = null), (u = D.p), (D.p = 2), (i = Sl), (Sl |= 4));
        try {
          eh(l, t, e);
        } finally {
          ((Sl = i), (D.p = u), (T.T = a));
        }
      }
      ((et = 1), q0(), X0(), G0());
    }
  }
  function q0() {
    if (et === 1) {
      et = 0;
      var l = Fe,
        t = iu,
        e = (t.flags & 13878) !== 0;
      if ((t.subtreeFlags & 13878) !== 0 || e) {
        ((e = T.T), (T.T = null));
        var a = D.p;
        D.p = 2;
        var u = Sl;
        Sl |= 4;
        try {
          S0(t, l);
          var n = Af,
            i = Ao(l.containerInfo),
            c = n.focusedElem,
            o = n.selectionRange;
          if (
            i !== c &&
            c &&
            c.ownerDocument &&
            Eo(c.ownerDocument.documentElement, c)
          ) {
            if (o !== null && ki(c)) {
              var g = o.start,
                z = o.end;
              if ((z === void 0 && (z = g), "selectionStart" in c))
                ((c.selectionStart = g),
                  (c.selectionEnd = Math.min(z, c.value.length)));
              else {
                var M = c.ownerDocument || document,
                  v = (M && M.defaultView) || window;
                if (v.getSelection) {
                  var b = v.getSelection(),
                    X = c.textContent.length,
                    w = Math.min(o.start, X),
                    _l = o.end === void 0 ? w : Math.min(o.end, X);
                  !b.extend && w > _l && ((i = _l), (_l = w), (w = i));
                  var y = zo(c, w),
                    s = zo(c, _l);
                  if (
                    y &&
                    s &&
                    (b.rangeCount !== 1 ||
                      b.anchorNode !== y.node ||
                      b.anchorOffset !== y.offset ||
                      b.focusNode !== s.node ||
                      b.focusOffset !== s.offset)
                  ) {
                    var m = M.createRange();
                    (m.setStart(y.node, y.offset),
                      b.removeAllRanges(),
                      w > _l
                        ? (b.addRange(m), b.extend(s.node, s.offset))
                        : (m.setEnd(s.node, s.offset), b.addRange(m)));
                  }
                }
              }
            }
            for (M = [], b = c; (b = b.parentNode); )
              b.nodeType === 1 &&
                M.push({ element: b, left: b.scrollLeft, top: b.scrollTop });
            for (
              typeof c.focus == "function" && c.focus(), c = 0;
              c < M.length;
              c++
            ) {
              var E = M[c];
              ((E.element.scrollLeft = E.left), (E.element.scrollTop = E.top));
            }
          }
          ((Ei = !!Ef), (Af = Ef = null));
        } finally {
          ((Sl = u), (D.p = a), (T.T = e));
        }
      }
      ((l.current = t), (et = 2));
    }
  }
  function X0() {
    if (et === 2) {
      et = 0;
      var l = Fe,
        t = iu,
        e = (t.flags & 8772) !== 0;
      if ((t.subtreeFlags & 8772) !== 0 || e) {
        ((e = T.T), (T.T = null));
        var a = D.p;
        D.p = 2;
        var u = Sl;
        Sl |= 4;
        try {
          h0(l, t.alternate, t);
        } finally {
          ((Sl = u), (D.p = a), (T.T = e));
        }
      }
      et = 3;
    }
  }
  function G0() {
    if (et === 4 || et === 3) {
      ((et = 0), Ce());
      var l = Fe,
        t = iu,
        e = Ue,
        a = x0;
      (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0
        ? (et = 5)
        : ((et = 0), (iu = Fe = null), Q0(l, l.pendingLanes));
      var u = l.pendingLanes;
      if (
        (u === 0 && ($e = null),
        vt(e),
        (t = t.stateNode),
        Ul && typeof Ul.onCommitFiberRoot == "function")
      )
        try {
          Ul.onCommitFiberRoot(Be, t, void 0, (t.current.flags & 128) === 128);
        } catch {}
      if (a !== null) {
        ((t = T.T), (u = D.p), (D.p = 2), (T.T = null));
        try {
          for (var n = l.onRecoverableError, i = 0; i < a.length; i++) {
            var c = a[i];
            n(c.value, { componentStack: c.stack });
          }
        } finally {
          ((T.T = t), (D.p = u));
        }
      }
      ((Ue & 3) !== 0 && ri(),
        se(l),
        (u = l.pendingLanes),
        (e & 261930) !== 0 && (u & 42) !== 0
          ? l === sf
            ? tn++
            : ((tn = 0), (sf = l))
          : (tn = 0),
        en(0));
    }
  }
  function Q0(l, t) {
    (l.pooledCacheLanes &= t) === 0 &&
      ((t = l.pooledCache), t != null && ((l.pooledCache = null), Nu(t)));
  }
  function ri() {
    return (q0(), X0(), G0(), L0());
  }
  function L0() {
    if (et !== 5) return !1;
    var l = Fe,
      t = ff;
    ff = 0;
    var e = vt(Ue),
      a = T.T,
      u = D.p;
    try {
      ((D.p = 32 > e ? 32 : e), (T.T = null), (e = of), (of = null));
      var n = Fe,
        i = Ue;
      if (((et = 0), (iu = Fe = null), (Ue = 0), (Sl & 6) !== 0))
        throw Error(h(331));
      var c = Sl;
      if (
        ((Sl |= 4),
        E0(n.current),
        p0(n, n.current, i, e),
        (Sl = c),
        en(0, !1),
        Ul && typeof Ul.onPostCommitFiberRoot == "function")
      )
        try {
          Ul.onPostCommitFiberRoot(Be, n);
        } catch {}
      return !0;
    } finally {
      ((D.p = u), (T.T = a), Q0(l, t));
    }
  }
  function Z0(l, t, e) {
    ((t = Gt(e, t)),
      (t = Qc(l.stateNode, t, 2)),
      (l = Ve(l, t, 2)),
      l !== null && (Wt(l, 2), se(l)));
  }
  function Al(l, t, e) {
    if (l.tag === 3) Z0(l, l, e);
    else
      for (; t !== null; ) {
        if (t.tag === 3) {
          Z0(t, l, e);
          break;
        } else if (t.tag === 1) {
          var a = t.stateNode;
          if (
            typeof t.type.getDerivedStateFromError == "function" ||
            (typeof a.componentDidCatch == "function" &&
              ($e === null || !$e.has(a)))
          ) {
            ((l = Gt(e, l)),
              (e = Vs(2)),
              (a = Ve(t, e, 2)),
              a !== null && (Js(e, a, t, l), Wt(a, 2), se(a)));
            break;
          }
        }
        t = t.return;
      }
  }
  function hf(l, t, e) {
    var a = l.pingCache;
    if (a === null) {
      a = l.pingCache = new nh();
      var u = new Set();
      a.set(t, u);
    } else ((u = a.get(t)), u === void 0 && ((u = new Set()), a.set(t, u)));
    u.has(e) ||
      ((uf = !0), u.add(e), (l = sh.bind(null, l, t, e)), t.then(l, l));
  }
  function sh(l, t, e) {
    var a = l.pingCache;
    (a !== null && a.delete(t),
      (l.pingedLanes |= l.suspendedLanes & e),
      (l.warmLanes &= ~e),
      jl === l &&
        (sl & e) === e &&
        (Ll === 4 || (Ll === 3 && (sl & 62914560) === sl && 300 > vl() - ni)
          ? (Sl & 2) === 0 && cu(l, 0)
          : (nf |= e),
        nu === sl && (nu = 0)),
      se(l));
  }
  function V0(l, t) {
    (t === 0 && (t = bn()), (l = ga(l, t)), l !== null && (Wt(l, t), se(l)));
  }
  function rh(l) {
    var t = l.memoizedState,
      e = 0;
    (t !== null && (e = t.retryLane), V0(l, e));
  }
  function dh(l, t) {
    var e = 0;
    switch (l.tag) {
      case 31:
      case 13:
        var a = l.stateNode,
          u = l.memoizedState;
        u !== null && (e = u.retryLane);
        break;
      case 19:
        a = l.stateNode;
        break;
      case 22:
        a = l.stateNode._retryCache;
        break;
      default:
        throw Error(h(314));
    }
    (a !== null && a.delete(t), V0(l, e));
  }
  function hh(l, t) {
    return mu(l, t);
  }
  var di = null,
    ou = null,
    yf = !1,
    hi = !1,
    mf = !1,
    Pe = 0;
  function se(l) {
    (l !== ou &&
      l.next === null &&
      (ou === null ? (di = ou = l) : (ou = ou.next = l)),
      (hi = !0),
      yf || ((yf = !0), mh()));
  }
  function en(l, t) {
    if (!mf && hi) {
      mf = !0;
      do
        for (var e = !1, a = di; a !== null; ) {
          if (l !== 0) {
            var u = a.pendingLanes;
            if (u === 0) var n = 0;
            else {
              var i = a.suspendedLanes,
                c = a.pingedLanes;
              ((n = (1 << (31 - mt(42 | l) + 1)) - 1),
                (n &= u & ~(i & ~c)),
                (n = n & 201326741 ? (n & 201326741) | 1 : n ? n | 2 : 0));
            }
            n !== 0 && ((e = !0), k0(a, n));
          } else
            ((n = sl),
              (n = Ca(
                a,
                a === jl ? n : 0,
                a.cancelPendingCommit !== null || a.timeoutHandle !== -1,
              )),
              (n & 3) === 0 || ra(a, n) || ((e = !0), k0(a, n)));
          a = a.next;
        }
      while (e);
      mf = !1;
    }
  }
  function yh() {
    J0();
  }
  function J0() {
    hi = yf = !1;
    var l = 0;
    Pe !== 0 && Mh() && (l = Pe);
    for (var t = vl(), e = null, a = di; a !== null; ) {
      var u = a.next,
        n = K0(a, t);
      (n === 0
        ? ((a.next = null),
          e === null ? (di = u) : (e.next = u),
          u === null && (ou = e))
        : ((e = a), (l !== 0 || (n & 3) !== 0) && (hi = !0)),
        (a = u));
    }
    ((et !== 0 && et !== 5) || en(l), Pe !== 0 && (Pe = 0));
  }
  function K0(l, t) {
    for (
      var e = l.suspendedLanes,
        a = l.pingedLanes,
        u = l.expirationTimes,
        n = l.pendingLanes & -62914561;
      0 < n;
    ) {
      var i = 31 - mt(n),
        c = 1 << i,
        o = u[i];
      (o === -1
        ? ((c & e) === 0 || (c & a) !== 0) && (u[i] = Sn(c, t))
        : o <= t && (l.expiredLanes |= c),
        (n &= ~c));
    }
    if (
      ((t = jl),
      (e = sl),
      (e = Ca(
        l,
        l === t ? e : 0,
        l.cancelPendingCommit !== null || l.timeoutHandle !== -1,
      )),
      (a = l.callbackNode),
      e === 0 ||
        (l === t && (El === 2 || El === 9)) ||
        l.cancelPendingCommit !== null)
    )
      return (
        a !== null && a !== null && gu(a),
        (l.callbackNode = null),
        (l.callbackPriority = 0)
      );
    if ((e & 3) === 0 || ra(l, e)) {
      if (((t = e & -e), t === l.callbackPriority)) return t;
      switch ((a !== null && gu(a), vt(e))) {
        case 2:
        case 8:
          e = wt;
          break;
        case 32:
          e = oa;
          break;
        case 268435456:
          e = Su;
          break;
        default:
          e = oa;
      }
      return (
        (a = w0.bind(null, l)),
        (e = mu(e, a)),
        (l.callbackPriority = t),
        (l.callbackNode = e),
        t
      );
    }
    return (
      a !== null && a !== null && gu(a),
      (l.callbackPriority = 2),
      (l.callbackNode = null),
      2
    );
  }
  function w0(l, t) {
    if (et !== 0 && et !== 5)
      return ((l.callbackNode = null), (l.callbackPriority = 0), null);
    var e = l.callbackNode;
    if (ri() && l.callbackNode !== e) return null;
    var a = sl;
    return (
      (a = Ca(
        l,
        l === jl ? a : 0,
        l.cancelPendingCommit !== null || l.timeoutHandle !== -1,
      )),
      a === 0
        ? null
        : (O0(l, a, t),
          K0(l, vl()),
          l.callbackNode != null && l.callbackNode === e
            ? w0.bind(null, l)
            : null)
    );
  }
  function k0(l, t) {
    if (ri()) return null;
    O0(l, t, !0);
  }
  function mh() {
    _h(function () {
      (Sl & 6) !== 0 ? mu(vn, yh) : J0();
    });
  }
  function gf() {
    if (Pe === 0) {
      var l = ka;
      (l === 0 && ((l = re), (re <<= 1), (re & 261888) === 0 && (re = 256)),
        (Pe = l));
    }
    return Pe;
  }
  function W0(l) {
    return l == null || typeof l == "symbol" || typeof l == "boolean"
      ? null
      : typeof l == "function"
        ? l
        : Tn("" + l);
  }
  function $0(l, t) {
    var e = t.ownerDocument.createElement("input");
    return (
      (e.name = t.name),
      (e.value = t.value),
      l.id && e.setAttribute("form", l.id),
      t.parentNode.insertBefore(e, t),
      (l = new FormData(l)),
      e.parentNode.removeChild(e),
      l
    );
  }
  function gh(l, t, e, a, u) {
    if (t === "submit" && e && e.stateNode === u) {
      var n = W0((u[ht] || null).action),
        i = a.submitter;
      i &&
        ((t = (t = i[ht] || null)
          ? W0(t.formAction)
          : i.getAttribute("formAction")),
        t !== null && ((n = t), (i = null)));
      var c = new Mn("action", "action", null, a, u);
      l.push({
        event: c,
        listeners: [
          {
            instance: null,
            listener: function () {
              if (a.defaultPrevented) {
                if (Pe !== 0) {
                  var o = i ? $0(u, i) : new FormData(u);
                  Bc(
                    e,
                    { pending: !0, data: o, method: u.method, action: n },
                    null,
                    o,
                  );
                }
              } else
                typeof n == "function" &&
                  (c.preventDefault(),
                  (o = i ? $0(u, i) : new FormData(u)),
                  Bc(
                    e,
                    { pending: !0, data: o, method: u.method, action: n },
                    n,
                    o,
                  ));
            },
            currentTarget: u,
          },
        ],
      });
    }
  }
  for (var vf = 0; vf < Ii.length; vf++) {
    var Sf = Ii[vf],
      vh = Sf.toLowerCase(),
      Sh = Sf[0].toUpperCase() + Sf.slice(1);
    Pt(vh, "on" + Sh);
  }
  (Pt(_o, "onAnimationEnd"),
    Pt(Oo, "onAnimationIteration"),
    Pt(Do, "onAnimationStart"),
    Pt("dblclick", "onDoubleClick"),
    Pt("focusin", "onFocus"),
    Pt("focusout", "onBlur"),
    Pt(Hd, "onTransitionRun"),
    Pt(Bd, "onTransitionStart"),
    Pt(Nd, "onTransitionCancel"),
    Pt(Ro, "onTransitionEnd"),
    tt("onMouseEnter", ["mouseout", "mouseover"]),
    tt("onMouseLeave", ["mouseout", "mouseover"]),
    tt("onPointerEnter", ["pointerout", "pointerover"]),
    tt("onPointerLeave", ["pointerout", "pointerover"]),
    P(
      "onChange",
      "change click focusin focusout input keydown keyup selectionchange".split(
        " ",
      ),
    ),
    P(
      "onSelect",
      "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
        " ",
      ),
    ),
    P("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]),
    P(
      "onCompositionEnd",
      "compositionend focusout keydown keypress keyup mousedown".split(" "),
    ),
    P(
      "onCompositionStart",
      "compositionstart focusout keydown keypress keyup mousedown".split(" "),
    ),
    P(
      "onCompositionUpdate",
      "compositionupdate focusout keydown keypress keyup mousedown".split(" "),
    ));
  var an =
      "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
        " ",
      ),
    bh = new Set(
      "beforetoggle cancel close invalid load scroll scrollend toggle"
        .split(" ")
        .concat(an),
    );
  function F0(l, t) {
    t = (t & 4) !== 0;
    for (var e = 0; e < l.length; e++) {
      var a = l[e],
        u = a.event;
      a = a.listeners;
      l: {
        var n = void 0;
        if (t)
          for (var i = a.length - 1; 0 <= i; i--) {
            var c = a[i],
              o = c.instance,
              g = c.currentTarget;
            if (((c = c.listener), o !== n && u.isPropagationStopped()))
              break l;
            ((n = c), (u.currentTarget = g));
            try {
              n(u);
            } catch (z) {
              On(z);
            }
            ((u.currentTarget = null), (n = o));
          }
        else
          for (i = 0; i < a.length; i++) {
            if (
              ((c = a[i]),
              (o = c.instance),
              (g = c.currentTarget),
              (c = c.listener),
              o !== n && u.isPropagationStopped())
            )
              break l;
            ((n = c), (u.currentTarget = g));
            try {
              n(u);
            } catch (z) {
              On(z);
            }
            ((u.currentTarget = null), (n = o));
          }
      }
    }
  }
  function cl(l, t) {
    var e = t[_];
    e === void 0 && (e = t[_] = new Set());
    var a = l + "__bubble";
    e.has(a) || (I0(t, l, 2, !1), e.add(a));
  }
  function bf(l, t, e) {
    var a = 0;
    (t && (a |= 4), I0(e, l, a, t));
  }
  var yi = "_reactListening" + Math.random().toString(36).slice(2);
  function pf(l) {
    if (!l[yi]) {
      ((l[yi] = !0),
        Ft.forEach(function (e) {
          e !== "selectionchange" && (bh.has(e) || bf(e, !1, l), bf(e, !0, l));
        }));
      var t = l.nodeType === 9 ? l : l.ownerDocument;
      t === null || t[yi] || ((t[yi] = !0), bf("selectionchange", !1, t));
    }
  }
  function I0(l, t, e, a) {
    switch (_r(t)) {
      case 2:
        var u = wh;
        break;
      case 8:
        u = kh;
        break;
      default:
        u = Bf;
    }
    ((e = u.bind(null, t, e, l)),
      (u = void 0),
      !Xi ||
        (t !== "touchstart" && t !== "touchmove" && t !== "wheel") ||
        (u = !0),
      a
        ? u !== void 0
          ? l.addEventListener(t, e, { capture: !0, passive: u })
          : l.addEventListener(t, e, !0)
        : u !== void 0
          ? l.addEventListener(t, e, { passive: u })
          : l.addEventListener(t, e, !1));
  }
  function Tf(l, t, e, a, u) {
    var n = a;
    if ((t & 1) === 0 && (t & 2) === 0 && a !== null)
      l: for (;;) {
        if (a === null) return;
        var i = a.tag;
        if (i === 3 || i === 4) {
          var c = a.stateNode.containerInfo;
          if (c === u) break;
          if (i === 4)
            for (i = a.return; i !== null; ) {
              var o = i.tag;
              if ((o === 3 || o === 4) && i.stateNode.containerInfo === u)
                return;
              i = i.return;
            }
          for (; c !== null; ) {
            if (((i = ne(c)), i === null)) return;
            if (((o = i.tag), o === 5 || o === 6 || o === 26 || o === 27)) {
              a = n = i;
              continue l;
            }
            c = c.parentNode;
          }
        }
        a = a.return;
      }
    eo(function () {
      var g = n,
        z = Yi(e),
        M = [];
      l: {
        var v = Uo.get(l);
        if (v !== void 0) {
          var b = Mn,
            X = l;
          switch (l) {
            case "keypress":
              if (En(e) === 0) break l;
            case "keydown":
            case "keyup":
              b = dd;
              break;
            case "focusin":
              ((X = "focus"), (b = Zi));
              break;
            case "focusout":
              ((X = "blur"), (b = Zi));
              break;
            case "beforeblur":
            case "afterblur":
              b = Zi;
              break;
            case "click":
              if (e.button === 2) break l;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              b = no;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              b = ld;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              b = md;
              break;
            case _o:
            case Oo:
            case Do:
              b = ad;
              break;
            case Ro:
              b = vd;
              break;
            case "scroll":
            case "scrollend":
              b = Ir;
              break;
            case "wheel":
              b = bd;
              break;
            case "copy":
            case "cut":
            case "paste":
              b = nd;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              b = co;
              break;
            case "toggle":
            case "beforetoggle":
              b = Td;
          }
          var w = (t & 4) !== 0,
            _l = !w && (l === "scroll" || l === "scrollend"),
            y = w ? (v !== null ? v + "Capture" : null) : v;
          w = [];
          for (var s = g, m; s !== null; ) {
            var E = s;
            if (
              ((m = E.stateNode),
              (E = E.tag),
              (E !== 5 && E !== 26 && E !== 27) ||
                m === null ||
                y === null ||
                ((E = Mu(s, y)), E != null && w.push(un(s, E, m))),
              _l)
            )
              break;
            s = s.return;
          }
          0 < w.length &&
            ((v = new b(v, X, null, e, z)), M.push({ event: v, listeners: w }));
        }
      }
      if ((t & 7) === 0) {
        l: {
          if (
            ((v = l === "mouseover" || l === "pointerover"),
            (b = l === "mouseout" || l === "pointerout"),
            v &&
              e !== Ni &&
              (X = e.relatedTarget || e.fromElement) &&
              (ne(X) || X[Ne]))
          )
            break l;
          if (
            (b || v) &&
            ((v =
              z.window === z
                ? z
                : (v = z.ownerDocument)
                  ? v.defaultView || v.parentWindow
                  : window),
            b
              ? ((X = e.relatedTarget || e.toElement),
                (b = g),
                (X = X ? ne(X) : null),
                X !== null &&
                  ((_l = B(X)),
                  (w = X.tag),
                  X !== _l || (w !== 5 && w !== 27 && w !== 6)) &&
                  (X = null))
              : ((b = null), (X = g)),
            b !== X)
          ) {
            if (
              ((w = no),
              (E = "onMouseLeave"),
              (y = "onMouseEnter"),
              (s = "mouse"),
              (l === "pointerout" || l === "pointerover") &&
                ((w = co),
                (E = "onPointerLeave"),
                (y = "onPointerEnter"),
                (s = "pointer")),
              (_l = b == null ? v : ie(b)),
              (m = X == null ? v : ie(X)),
              (v = new w(E, s + "leave", b, e, z)),
              (v.target = _l),
              (v.relatedTarget = m),
              (E = null),
              ne(z) === g &&
                ((w = new w(y, s + "enter", X, e, z)),
                (w.target = m),
                (w.relatedTarget = _l),
                (E = w)),
              (_l = E),
              b && X)
            )
              t: {
                for (w = ph, y = b, s = X, m = 0, E = y; E; E = w(E)) m++;
                E = 0;
                for (var J = s; J; J = w(J)) E++;
                for (; 0 < m - E; ) ((y = w(y)), m--);
                for (; 0 < E - m; ) ((s = w(s)), E--);
                for (; m--; ) {
                  if (y === s || (s !== null && y === s.alternate)) {
                    w = y;
                    break t;
                  }
                  ((y = w(y)), (s = w(s)));
                }
                w = null;
              }
            else w = null;
            (b !== null && P0(M, v, b, w, !1),
              X !== null && _l !== null && P0(M, _l, X, w, !0));
          }
        }
        l: {
          if (
            ((v = g ? ie(g) : window),
            (b = v.nodeName && v.nodeName.toLowerCase()),
            b === "select" || (b === "input" && v.type === "file"))
          )
            var ml = go;
          else if (yo(v))
            if (vo) ml = Ud;
            else {
              ml = Dd;
              var L = Od;
            }
          else
            ((b = v.nodeName),
              !b ||
              b.toLowerCase() !== "input" ||
              (v.type !== "checkbox" && v.type !== "radio")
                ? g && Bi(g.elementType) && (ml = go)
                : (ml = Rd));
          if (ml && (ml = ml(l, g))) {
            mo(M, ml, e, z);
            break l;
          }
          (L && L(l, v, g),
            l === "focusout" &&
              g &&
              v.type === "number" &&
              g.memoizedProps.value != null &&
              Hi(v, "number", v.value));
        }
        switch (((L = g ? ie(g) : window), l)) {
          case "focusin":
            (yo(L) || L.contentEditable === "true") &&
              ((Ga = L), (Wi = g), (Cu = null));
            break;
          case "focusout":
            Cu = Wi = Ga = null;
            break;
          case "mousedown":
            $i = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            (($i = !1), Mo(M, e, z));
            break;
          case "selectionchange":
            if (Cd) break;
          case "keydown":
          case "keyup":
            Mo(M, e, z);
        }
        var al;
        if (Ji)
          l: {
            switch (l) {
              case "compositionstart":
                var rl = "onCompositionStart";
                break l;
              case "compositionend":
                rl = "onCompositionEnd";
                break l;
              case "compositionupdate":
                rl = "onCompositionUpdate";
                break l;
            }
            rl = void 0;
          }
        else
          Xa
            ? ro(l, e) && (rl = "onCompositionEnd")
            : l === "keydown" &&
              e.keyCode === 229 &&
              (rl = "onCompositionStart");
        (rl &&
          (fo &&
            e.locale !== "ko" &&
            (Xa || rl !== "onCompositionStart"
              ? rl === "onCompositionEnd" && Xa && (al = ao())
              : ((Ye = z),
                (Gi = "value" in Ye ? Ye.value : Ye.textContent),
                (Xa = !0))),
          (L = mi(g, rl)),
          0 < L.length &&
            ((rl = new io(rl, l, null, e, z)),
            M.push({ event: rl, listeners: L }),
            al
              ? (rl.data = al)
              : ((al = ho(e)), al !== null && (rl.data = al)))),
          (al = Ed ? Ad(l, e) : Md(l, e)) &&
            ((rl = mi(g, "onBeforeInput")),
            0 < rl.length &&
              ((L = new io("onBeforeInput", "beforeinput", null, e, z)),
              M.push({ event: L, listeners: rl }),
              (L.data = al))),
          gh(M, l, g, e, z));
      }
      F0(M, t);
    });
  }
  function un(l, t, e) {
    return { instance: l, listener: t, currentTarget: e };
  }
  function mi(l, t) {
    for (var e = t + "Capture", a = []; l !== null; ) {
      var u = l,
        n = u.stateNode;
      if (
        ((u = u.tag),
        (u !== 5 && u !== 26 && u !== 27) ||
          n === null ||
          ((u = Mu(l, e)),
          u != null && a.unshift(un(l, u, n)),
          (u = Mu(l, t)),
          u != null && a.push(un(l, u, n))),
        l.tag === 3)
      )
        return a;
      l = l.return;
    }
    return [];
  }
  function ph(l) {
    if (l === null) return null;
    do l = l.return;
    while (l && l.tag !== 5 && l.tag !== 27);
    return l || null;
  }
  function P0(l, t, e, a, u) {
    for (var n = t._reactName, i = []; e !== null && e !== a; ) {
      var c = e,
        o = c.alternate,
        g = c.stateNode;
      if (((c = c.tag), o !== null && o === a)) break;
      ((c !== 5 && c !== 26 && c !== 27) ||
        g === null ||
        ((o = g),
        u
          ? ((g = Mu(e, n)), g != null && i.unshift(un(e, g, o)))
          : u || ((g = Mu(e, n)), g != null && i.push(un(e, g, o)))),
        (e = e.return));
    }
    i.length !== 0 && l.push({ event: t, listeners: i });
  }
  var Th = /\r\n?/g,
    zh = /\u0000|\uFFFD/g;
  function lr(l) {
    return (typeof l == "string" ? l : "" + l)
      .replace(
        Th,
        `
`,
      )
      .replace(zh, "");
  }
  function tr(l, t) {
    return ((t = lr(t)), lr(l) === t);
  }
  function xl(l, t, e, a, u, n) {
    switch (e) {
      case "children":
        typeof a == "string"
          ? t === "body" || (t === "textarea" && a === "") || Na(l, a)
          : (typeof a == "number" || typeof a == "bigint") &&
            t !== "body" &&
            Na(l, "" + a);
        break;
      case "className":
        It(l, "class", a);
        break;
      case "tabIndex":
        It(l, "tabindex", a);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        It(l, e, a);
        break;
      case "style":
        lo(l, a, n);
        break;
      case "data":
        if (t !== "object") {
          It(l, "data", a);
          break;
        }
      case "src":
      case "href":
        if (a === "" && (t !== "a" || e !== "href")) {
          l.removeAttribute(e);
          break;
        }
        if (
          a == null ||
          typeof a == "function" ||
          typeof a == "symbol" ||
          typeof a == "boolean"
        ) {
          l.removeAttribute(e);
          break;
        }
        ((a = Tn("" + a)), l.setAttribute(e, a));
        break;
      case "action":
      case "formAction":
        if (typeof a == "function") {
          l.setAttribute(
            e,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')",
          );
          break;
        } else
          typeof n == "function" &&
            (e === "formAction"
              ? (t !== "input" && xl(l, t, "name", u.name, u, null),
                xl(l, t, "formEncType", u.formEncType, u, null),
                xl(l, t, "formMethod", u.formMethod, u, null),
                xl(l, t, "formTarget", u.formTarget, u, null))
              : (xl(l, t, "encType", u.encType, u, null),
                xl(l, t, "method", u.method, u, null),
                xl(l, t, "target", u.target, u, null)));
        if (a == null || typeof a == "symbol" || typeof a == "boolean") {
          l.removeAttribute(e);
          break;
        }
        ((a = Tn("" + a)), l.setAttribute(e, a));
        break;
      case "onClick":
        a != null && (l.onclick = ge);
        break;
      case "onScroll":
        a != null && cl("scroll", l);
        break;
      case "onScrollEnd":
        a != null && cl("scrollend", l);
        break;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a)) throw Error(h(61));
          if (((e = a.__html), e != null)) {
            if (u.children != null) throw Error(h(60));
            l.innerHTML = e;
          }
        }
        break;
      case "multiple":
        l.multiple = a && typeof a != "function" && typeof a != "symbol";
        break;
      case "muted":
        l.muted = a && typeof a != "function" && typeof a != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (
          a == null ||
          typeof a == "function" ||
          typeof a == "boolean" ||
          typeof a == "symbol"
        ) {
          l.removeAttribute("xlink:href");
          break;
        }
        ((e = Tn("" + a)),
          l.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", e));
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        a != null && typeof a != "function" && typeof a != "symbol"
          ? l.setAttribute(e, "" + a)
          : l.removeAttribute(e);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        a && typeof a != "function" && typeof a != "symbol"
          ? l.setAttribute(e, "")
          : l.removeAttribute(e);
        break;
      case "capture":
      case "download":
        a === !0
          ? l.setAttribute(e, "")
          : a !== !1 &&
              a != null &&
              typeof a != "function" &&
              typeof a != "symbol"
            ? l.setAttribute(e, a)
            : l.removeAttribute(e);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        a != null &&
        typeof a != "function" &&
        typeof a != "symbol" &&
        !isNaN(a) &&
        1 <= a
          ? l.setAttribute(e, a)
          : l.removeAttribute(e);
        break;
      case "rowSpan":
      case "start":
        a == null || typeof a == "function" || typeof a == "symbol" || isNaN(a)
          ? l.removeAttribute(e)
          : l.setAttribute(e, a);
        break;
      case "popover":
        (cl("beforetoggle", l), cl("toggle", l), dl(l, "popover", a));
        break;
      case "xlinkActuate":
        Nt(l, "http://www.w3.org/1999/xlink", "xlink:actuate", a);
        break;
      case "xlinkArcrole":
        Nt(l, "http://www.w3.org/1999/xlink", "xlink:arcrole", a);
        break;
      case "xlinkRole":
        Nt(l, "http://www.w3.org/1999/xlink", "xlink:role", a);
        break;
      case "xlinkShow":
        Nt(l, "http://www.w3.org/1999/xlink", "xlink:show", a);
        break;
      case "xlinkTitle":
        Nt(l, "http://www.w3.org/1999/xlink", "xlink:title", a);
        break;
      case "xlinkType":
        Nt(l, "http://www.w3.org/1999/xlink", "xlink:type", a);
        break;
      case "xmlBase":
        Nt(l, "http://www.w3.org/XML/1998/namespace", "xml:base", a);
        break;
      case "xmlLang":
        Nt(l, "http://www.w3.org/XML/1998/namespace", "xml:lang", a);
        break;
      case "xmlSpace":
        Nt(l, "http://www.w3.org/XML/1998/namespace", "xml:space", a);
        break;
      case "is":
        dl(l, "is", a);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        (!(2 < e.length) ||
          (e[0] !== "o" && e[0] !== "O") ||
          (e[1] !== "n" && e[1] !== "N")) &&
          ((e = $r.get(e) || e), dl(l, e, a));
    }
  }
  function zf(l, t, e, a, u, n) {
    switch (e) {
      case "style":
        lo(l, a, n);
        break;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a)) throw Error(h(61));
          if (((e = a.__html), e != null)) {
            if (u.children != null) throw Error(h(60));
            l.innerHTML = e;
          }
        }
        break;
      case "children":
        typeof a == "string"
          ? Na(l, a)
          : (typeof a == "number" || typeof a == "bigint") && Na(l, "" + a);
        break;
      case "onScroll":
        a != null && cl("scroll", l);
        break;
      case "onScrollEnd":
        a != null && cl("scrollend", l);
        break;
      case "onClick":
        a != null && (l.onclick = ge);
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        if (!Au.hasOwnProperty(e))
          l: {
            if (
              e[0] === "o" &&
              e[1] === "n" &&
              ((u = e.endsWith("Capture")),
              (t = e.slice(2, u ? e.length - 7 : void 0)),
              (n = l[ht] || null),
              (n = n != null ? n[e] : null),
              typeof n == "function" && l.removeEventListener(t, n, u),
              typeof a == "function")
            ) {
              (typeof n != "function" &&
                n !== null &&
                (e in l
                  ? (l[e] = null)
                  : l.hasAttribute(e) && l.removeAttribute(e)),
                l.addEventListener(t, a, u));
              break l;
            }
            e in l
              ? (l[e] = a)
              : a === !0
                ? l.setAttribute(e, "")
                : dl(l, e, a);
          }
    }
  }
  function dt(l, t, e) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        (cl("error", l), cl("load", l));
        var a = !1,
          u = !1,
          n;
        for (n in e)
          if (e.hasOwnProperty(n)) {
            var i = e[n];
            if (i != null)
              switch (n) {
                case "src":
                  a = !0;
                  break;
                case "srcSet":
                  u = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(h(137, t));
                default:
                  xl(l, t, n, i, e, null);
              }
          }
        (u && xl(l, t, "srcSet", e.srcSet, e, null),
          a && xl(l, t, "src", e.src, e, null));
        return;
      case "input":
        cl("invalid", l);
        var c = (n = i = u = null),
          o = null,
          g = null;
        for (a in e)
          if (e.hasOwnProperty(a)) {
            var z = e[a];
            if (z != null)
              switch (a) {
                case "name":
                  u = z;
                  break;
                case "type":
                  i = z;
                  break;
                case "checked":
                  o = z;
                  break;
                case "defaultChecked":
                  g = z;
                  break;
                case "value":
                  n = z;
                  break;
                case "defaultValue":
                  c = z;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (z != null) throw Error(h(137, t));
                  break;
                default:
                  xl(l, t, a, z, e, null);
              }
          }
        $f(l, n, c, o, g, i, u, !1);
        return;
      case "select":
        (cl("invalid", l), (a = i = n = null));
        for (u in e)
          if (e.hasOwnProperty(u) && ((c = e[u]), c != null))
            switch (u) {
              case "value":
                n = c;
                break;
              case "defaultValue":
                i = c;
                break;
              case "multiple":
                a = c;
              default:
                xl(l, t, u, c, e, null);
            }
        ((t = n),
          (e = i),
          (l.multiple = !!a),
          t != null ? Ba(l, !!a, t, !1) : e != null && Ba(l, !!a, e, !0));
        return;
      case "textarea":
        (cl("invalid", l), (n = u = a = null));
        for (i in e)
          if (e.hasOwnProperty(i) && ((c = e[i]), c != null))
            switch (i) {
              case "value":
                a = c;
                break;
              case "defaultValue":
                u = c;
                break;
              case "children":
                n = c;
                break;
              case "dangerouslySetInnerHTML":
                if (c != null) throw Error(h(91));
                break;
              default:
                xl(l, t, i, c, e, null);
            }
        If(l, a, u, n);
        return;
      case "option":
        for (o in e)
          e.hasOwnProperty(o) &&
            ((a = e[o]), a != null) &&
            (o === "selected"
              ? (l.selected =
                  a && typeof a != "function" && typeof a != "symbol")
              : xl(l, t, o, a, e, null));
        return;
      case "dialog":
        (cl("beforetoggle", l),
          cl("toggle", l),
          cl("cancel", l),
          cl("close", l));
        break;
      case "iframe":
      case "object":
        cl("load", l);
        break;
      case "video":
      case "audio":
        for (a = 0; a < an.length; a++) cl(an[a], l);
        break;
      case "image":
        (cl("error", l), cl("load", l));
        break;
      case "details":
        cl("toggle", l);
        break;
      case "embed":
      case "source":
      case "link":
        (cl("error", l), cl("load", l));
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (g in e)
          if (e.hasOwnProperty(g) && ((a = e[g]), a != null))
            switch (g) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(h(137, t));
              default:
                xl(l, t, g, a, e, null);
            }
        return;
      default:
        if (Bi(t)) {
          for (z in e)
            e.hasOwnProperty(z) &&
              ((a = e[z]), a !== void 0 && zf(l, t, z, a, e, void 0));
          return;
        }
    }
    for (c in e)
      e.hasOwnProperty(c) && ((a = e[c]), a != null && xl(l, t, c, a, e, null));
  }
  function Eh(l, t, e, a) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var u = null,
          n = null,
          i = null,
          c = null,
          o = null,
          g = null,
          z = null;
        for (b in e) {
          var M = e[b];
          if (e.hasOwnProperty(b) && M != null)
            switch (b) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                o = M;
              default:
                a.hasOwnProperty(b) || xl(l, t, b, null, a, M);
            }
        }
        for (var v in a) {
          var b = a[v];
          if (((M = e[v]), a.hasOwnProperty(v) && (b != null || M != null)))
            switch (v) {
              case "type":
                n = b;
                break;
              case "name":
                u = b;
                break;
              case "checked":
                g = b;
                break;
              case "defaultChecked":
                z = b;
                break;
              case "value":
                i = b;
                break;
              case "defaultValue":
                c = b;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (b != null) throw Error(h(137, t));
                break;
              default:
                b !== M && xl(l, t, v, b, a, M);
            }
        }
        Ci(l, i, c, o, g, z, n, u);
        return;
      case "select":
        b = i = c = v = null;
        for (n in e)
          if (((o = e[n]), e.hasOwnProperty(n) && o != null))
            switch (n) {
              case "value":
                break;
              case "multiple":
                b = o;
              default:
                a.hasOwnProperty(n) || xl(l, t, n, null, a, o);
            }
        for (u in a)
          if (
            ((n = a[u]),
            (o = e[u]),
            a.hasOwnProperty(u) && (n != null || o != null))
          )
            switch (u) {
              case "value":
                v = n;
                break;
              case "defaultValue":
                c = n;
                break;
              case "multiple":
                i = n;
              default:
                n !== o && xl(l, t, u, n, a, o);
            }
        ((t = c),
          (e = i),
          (a = b),
          v != null
            ? Ba(l, !!e, v, !1)
            : !!a != !!e &&
              (t != null ? Ba(l, !!e, t, !0) : Ba(l, !!e, e ? [] : "", !1)));
        return;
      case "textarea":
        b = v = null;
        for (c in e)
          if (
            ((u = e[c]),
            e.hasOwnProperty(c) && u != null && !a.hasOwnProperty(c))
          )
            switch (c) {
              case "value":
                break;
              case "children":
                break;
              default:
                xl(l, t, c, null, a, u);
            }
        for (i in a)
          if (
            ((u = a[i]),
            (n = e[i]),
            a.hasOwnProperty(i) && (u != null || n != null))
          )
            switch (i) {
              case "value":
                v = u;
                break;
              case "defaultValue":
                b = u;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (u != null) throw Error(h(91));
                break;
              default:
                u !== n && xl(l, t, i, u, a, n);
            }
        Ff(l, v, b);
        return;
      case "option":
        for (var X in e)
          ((v = e[X]),
            e.hasOwnProperty(X) &&
              v != null &&
              !a.hasOwnProperty(X) &&
              (X === "selected" ? (l.selected = !1) : xl(l, t, X, null, a, v)));
        for (o in a)
          ((v = a[o]),
            (b = e[o]),
            a.hasOwnProperty(o) &&
              v !== b &&
              (v != null || b != null) &&
              (o === "selected"
                ? (l.selected =
                    v && typeof v != "function" && typeof v != "symbol")
                : xl(l, t, o, v, a, b)));
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var w in e)
          ((v = e[w]),
            e.hasOwnProperty(w) &&
              v != null &&
              !a.hasOwnProperty(w) &&
              xl(l, t, w, null, a, v));
        for (g in a)
          if (
            ((v = a[g]),
            (b = e[g]),
            a.hasOwnProperty(g) && v !== b && (v != null || b != null))
          )
            switch (g) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (v != null) throw Error(h(137, t));
                break;
              default:
                xl(l, t, g, v, a, b);
            }
        return;
      default:
        if (Bi(t)) {
          for (var _l in e)
            ((v = e[_l]),
              e.hasOwnProperty(_l) &&
                v !== void 0 &&
                !a.hasOwnProperty(_l) &&
                zf(l, t, _l, void 0, a, v));
          for (z in a)
            ((v = a[z]),
              (b = e[z]),
              !a.hasOwnProperty(z) ||
                v === b ||
                (v === void 0 && b === void 0) ||
                zf(l, t, z, v, a, b));
          return;
        }
    }
    for (var y in e)
      ((v = e[y]),
        e.hasOwnProperty(y) &&
          v != null &&
          !a.hasOwnProperty(y) &&
          xl(l, t, y, null, a, v));
    for (M in a)
      ((v = a[M]),
        (b = e[M]),
        !a.hasOwnProperty(M) ||
          v === b ||
          (v == null && b == null) ||
          xl(l, t, M, v, a, b));
  }
  function er(l) {
    switch (l) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function Ah() {
    if (typeof performance.getEntriesByType == "function") {
      for (
        var l = 0, t = 0, e = performance.getEntriesByType("resource"), a = 0;
        a < e.length;
        a++
      ) {
        var u = e[a],
          n = u.transferSize,
          i = u.initiatorType,
          c = u.duration;
        if (n && c && er(i)) {
          for (i = 0, c = u.responseEnd, a += 1; a < e.length; a++) {
            var o = e[a],
              g = o.startTime;
            if (g > c) break;
            var z = o.transferSize,
              M = o.initiatorType;
            z &&
              er(M) &&
              ((o = o.responseEnd), (i += z * (o < c ? 1 : (c - g) / (o - g))));
          }
          if ((--a, (t += (8 * (n + i)) / (u.duration / 1e3)), l++, 10 < l))
            break;
        }
      }
      if (0 < l) return t / l / 1e6;
    }
    return navigator.connection &&
      ((l = navigator.connection.downlink), typeof l == "number")
      ? l
      : 5;
  }
  var Ef = null,
    Af = null;
  function gi(l) {
    return l.nodeType === 9 ? l : l.ownerDocument;
  }
  function ar(l) {
    switch (l) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function ur(l, t) {
    if (l === 0)
      switch (t) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return l === 1 && t === "foreignObject" ? 0 : l;
  }
  function Mf(l, t) {
    return (
      l === "textarea" ||
      l === "noscript" ||
      typeof t.children == "string" ||
      typeof t.children == "number" ||
      typeof t.children == "bigint" ||
      (typeof t.dangerouslySetInnerHTML == "object" &&
        t.dangerouslySetInnerHTML !== null &&
        t.dangerouslySetInnerHTML.__html != null)
    );
  }
  var xf = null;
  function Mh() {
    var l = window.event;
    return l && l.type === "popstate"
      ? l === xf
        ? !1
        : ((xf = l), !0)
      : ((xf = null), !1);
  }
  var nr = typeof setTimeout == "function" ? setTimeout : void 0,
    xh = typeof clearTimeout == "function" ? clearTimeout : void 0,
    ir = typeof Promise == "function" ? Promise : void 0,
    _h =
      typeof queueMicrotask == "function"
        ? queueMicrotask
        : typeof ir < "u"
          ? function (l) {
              return ir.resolve(null).then(l).catch(Oh);
            }
          : nr;
  function Oh(l) {
    setTimeout(function () {
      throw l;
    });
  }
  function la(l) {
    return l === "head";
  }
  function cr(l, t) {
    var e = t,
      a = 0;
    do {
      var u = e.nextSibling;
      if ((l.removeChild(e), u && u.nodeType === 8))
        if (((e = u.data), e === "/$" || e === "/&")) {
          if (a === 0) {
            (l.removeChild(u), hu(t));
            return;
          }
          a--;
        } else if (
          e === "$" ||
          e === "$?" ||
          e === "$~" ||
          e === "$!" ||
          e === "&"
        )
          a++;
        else if (e === "html") nn(l.ownerDocument.documentElement);
        else if (e === "head") {
          ((e = l.ownerDocument.head), nn(e));
          for (var n = e.firstChild; n; ) {
            var i = n.nextSibling,
              c = n.nodeName;
            (n[Jl] ||
              c === "SCRIPT" ||
              c === "STYLE" ||
              (c === "LINK" && n.rel.toLowerCase() === "stylesheet") ||
              e.removeChild(n),
              (n = i));
          }
        } else e === "body" && nn(l.ownerDocument.body);
      e = u;
    } while (e);
    hu(t);
  }
  function fr(l, t) {
    var e = l;
    l = 0;
    do {
      var a = e.nextSibling;
      if (
        (e.nodeType === 1
          ? t
            ? ((e._stashedDisplay = e.style.display),
              (e.style.display = "none"))
            : ((e.style.display = e._stashedDisplay || ""),
              e.getAttribute("style") === "" && e.removeAttribute("style"))
          : e.nodeType === 3 &&
            (t
              ? ((e._stashedText = e.nodeValue), (e.nodeValue = ""))
              : (e.nodeValue = e._stashedText || "")),
        a && a.nodeType === 8)
      )
        if (((e = a.data), e === "/$")) {
          if (l === 0) break;
          l--;
        } else (e !== "$" && e !== "$?" && e !== "$~" && e !== "$!") || l++;
      e = a;
    } while (e);
  }
  function _f(l) {
    var t = l.firstChild;
    for (t && t.nodeType === 10 && (t = t.nextSibling); t; ) {
      var e = t;
      switch (((t = t.nextSibling), e.nodeName)) {
        case "HTML":
        case "HEAD":
        case "BODY":
          (_f(e), ct(e));
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (e.rel.toLowerCase() === "stylesheet") continue;
      }
      l.removeChild(e);
    }
  }
  function Dh(l, t, e, a) {
    for (; l.nodeType === 1; ) {
      var u = e;
      if (l.nodeName.toLowerCase() !== t.toLowerCase()) {
        if (!a && (l.nodeName !== "INPUT" || l.type !== "hidden")) break;
      } else if (a) {
        if (!l[Jl])
          switch (t) {
            case "meta":
              if (!l.hasAttribute("itemprop")) break;
              return l;
            case "link":
              if (
                ((n = l.getAttribute("rel")),
                n === "stylesheet" && l.hasAttribute("data-precedence"))
              )
                break;
              if (
                n !== u.rel ||
                l.getAttribute("href") !==
                  (u.href == null || u.href === "" ? null : u.href) ||
                l.getAttribute("crossorigin") !==
                  (u.crossOrigin == null ? null : u.crossOrigin) ||
                l.getAttribute("title") !== (u.title == null ? null : u.title)
              )
                break;
              return l;
            case "style":
              if (l.hasAttribute("data-precedence")) break;
              return l;
            case "script":
              if (
                ((n = l.getAttribute("src")),
                (n !== (u.src == null ? null : u.src) ||
                  l.getAttribute("type") !== (u.type == null ? null : u.type) ||
                  l.getAttribute("crossorigin") !==
                    (u.crossOrigin == null ? null : u.crossOrigin)) &&
                  n &&
                  l.hasAttribute("async") &&
                  !l.hasAttribute("itemprop"))
              )
                break;
              return l;
            default:
              return l;
          }
      } else if (t === "input" && l.type === "hidden") {
        var n = u.name == null ? null : "" + u.name;
        if (u.type === "hidden" && l.getAttribute("name") === n) return l;
      } else return l;
      if (((l = Jt(l.nextSibling)), l === null)) break;
    }
    return null;
  }
  function Rh(l, t, e) {
    if (t === "") return null;
    for (; l.nodeType !== 3; )
      if (
        ((l.nodeType !== 1 || l.nodeName !== "INPUT" || l.type !== "hidden") &&
          !e) ||
        ((l = Jt(l.nextSibling)), l === null)
      )
        return null;
    return l;
  }
  function or(l, t) {
    for (; l.nodeType !== 8; )
      if (
        ((l.nodeType !== 1 || l.nodeName !== "INPUT" || l.type !== "hidden") &&
          !t) ||
        ((l = Jt(l.nextSibling)), l === null)
      )
        return null;
    return l;
  }
  function Of(l) {
    return l.data === "$?" || l.data === "$~";
  }
  function Df(l) {
    return (
      l.data === "$!" ||
      (l.data === "$?" && l.ownerDocument.readyState !== "loading")
    );
  }
  function Uh(l, t) {
    var e = l.ownerDocument;
    if (l.data === "$~") l._reactRetry = t;
    else if (l.data !== "$?" || e.readyState !== "loading") t();
    else {
      var a = function () {
        (t(), e.removeEventListener("DOMContentLoaded", a));
      };
      (e.addEventListener("DOMContentLoaded", a), (l._reactRetry = a));
    }
  }
  function Jt(l) {
    for (; l != null; l = l.nextSibling) {
      var t = l.nodeType;
      if (t === 1 || t === 3) break;
      if (t === 8) {
        if (
          ((t = l.data),
          t === "$" ||
            t === "$!" ||
            t === "$?" ||
            t === "$~" ||
            t === "&" ||
            t === "F!" ||
            t === "F")
        )
          break;
        if (t === "/$" || t === "/&") return null;
      }
    }
    return l;
  }
  var Rf = null;
  function sr(l) {
    l = l.nextSibling;
    for (var t = 0; l; ) {
      if (l.nodeType === 8) {
        var e = l.data;
        if (e === "/$" || e === "/&") {
          if (t === 0) return Jt(l.nextSibling);
          t--;
        } else
          (e !== "$" && e !== "$!" && e !== "$?" && e !== "$~" && e !== "&") ||
            t++;
      }
      l = l.nextSibling;
    }
    return null;
  }
  function rr(l) {
    l = l.previousSibling;
    for (var t = 0; l; ) {
      if (l.nodeType === 8) {
        var e = l.data;
        if (e === "$" || e === "$!" || e === "$?" || e === "$~" || e === "&") {
          if (t === 0) return l;
          t--;
        } else (e !== "/$" && e !== "/&") || t++;
      }
      l = l.previousSibling;
    }
    return null;
  }
  function dr(l, t, e) {
    switch (((t = gi(e)), l)) {
      case "html":
        if (((l = t.documentElement), !l)) throw Error(h(452));
        return l;
      case "head":
        if (((l = t.head), !l)) throw Error(h(453));
        return l;
      case "body":
        if (((l = t.body), !l)) throw Error(h(454));
        return l;
      default:
        throw Error(h(451));
    }
  }
  function nn(l) {
    for (var t = l.attributes; t.length; ) l.removeAttributeNode(t[0]);
    ct(l);
  }
  var Kt = new Map(),
    hr = new Set();
  function vi(l) {
    return typeof l.getRootNode == "function"
      ? l.getRootNode()
      : l.nodeType === 9
        ? l
        : l.ownerDocument;
  }
  var je = D.d;
  D.d = { f: jh, r: Ch, D: Hh, C: Bh, L: Nh, m: Yh, X: Xh, S: qh, M: Gh };
  function jh() {
    var l = je.f(),
      t = fi();
    return l || t;
  }
  function Ch(l) {
    var t = bt(l);
    t !== null && t.tag === 5 && t.type === "form" ? Rs(t) : je.r(l);
  }
  var su = typeof document > "u" ? null : document;
  function yr(l, t, e) {
    var a = su;
    if (a && typeof t == "string" && t) {
      var u = qt(t);
      ((u = 'link[rel="' + l + '"][href="' + u + '"]'),
        typeof e == "string" && (u += '[crossorigin="' + e + '"]'),
        hr.has(u) ||
          (hr.add(u),
          (l = { rel: l, crossOrigin: e, href: t }),
          a.querySelector(u) === null &&
            ((t = a.createElement("link")),
            dt(t, "link", l),
            nl(t),
            a.head.appendChild(t))));
    }
  }
  function Hh(l) {
    (je.D(l), yr("dns-prefetch", l, null));
  }
  function Bh(l, t) {
    (je.C(l, t), yr("preconnect", l, t));
  }
  function Nh(l, t, e) {
    je.L(l, t, e);
    var a = su;
    if (a && l && t) {
      var u = 'link[rel="preload"][as="' + qt(t) + '"]';
      t === "image" && e && e.imageSrcSet
        ? ((u += '[imagesrcset="' + qt(e.imageSrcSet) + '"]'),
          typeof e.imageSizes == "string" &&
            (u += '[imagesizes="' + qt(e.imageSizes) + '"]'))
        : (u += '[href="' + qt(l) + '"]');
      var n = u;
      switch (t) {
        case "style":
          n = ru(l);
          break;
        case "script":
          n = du(l);
      }
      Kt.has(n) ||
        ((l = j(
          {
            rel: "preload",
            href: t === "image" && e && e.imageSrcSet ? void 0 : l,
            as: t,
          },
          e,
        )),
        Kt.set(n, l),
        a.querySelector(u) !== null ||
          (t === "style" && a.querySelector(cn(n))) ||
          (t === "script" && a.querySelector(fn(n))) ||
          ((t = a.createElement("link")),
          dt(t, "link", l),
          nl(t),
          a.head.appendChild(t)));
    }
  }
  function Yh(l, t) {
    je.m(l, t);
    var e = su;
    if (e && l) {
      var a = t && typeof t.as == "string" ? t.as : "script",
        u =
          'link[rel="modulepreload"][as="' + qt(a) + '"][href="' + qt(l) + '"]',
        n = u;
      switch (a) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          n = du(l);
      }
      if (
        !Kt.has(n) &&
        ((l = j({ rel: "modulepreload", href: l }, t)),
        Kt.set(n, l),
        e.querySelector(u) === null)
      ) {
        switch (a) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (e.querySelector(fn(n))) return;
        }
        ((a = e.createElement("link")),
          dt(a, "link", l),
          nl(a),
          e.head.appendChild(a));
      }
    }
  }
  function qh(l, t, e) {
    je.S(l, t, e);
    var a = su;
    if (a && l) {
      var u = $t(a).hoistableStyles,
        n = ru(l);
      t = t || "default";
      var i = u.get(n);
      if (!i) {
        var c = { loading: 0, preload: null };
        if ((i = a.querySelector(cn(n)))) c.loading = 5;
        else {
          ((l = j({ rel: "stylesheet", href: l, "data-precedence": t }, e)),
            (e = Kt.get(n)) && Uf(l, e));
          var o = (i = a.createElement("link"));
          (nl(o),
            dt(o, "link", l),
            (o._p = new Promise(function (g, z) {
              ((o.onload = g), (o.onerror = z));
            })),
            o.addEventListener("load", function () {
              c.loading |= 1;
            }),
            o.addEventListener("error", function () {
              c.loading |= 2;
            }),
            (c.loading |= 4),
            Si(i, t, a));
        }
        ((i = { type: "stylesheet", instance: i, count: 1, state: c }),
          u.set(n, i));
      }
    }
  }
  function Xh(l, t) {
    je.X(l, t);
    var e = su;
    if (e && l) {
      var a = $t(e).hoistableScripts,
        u = du(l),
        n = a.get(u);
      n ||
        ((n = e.querySelector(fn(u))),
        n ||
          ((l = j({ src: l, async: !0 }, t)),
          (t = Kt.get(u)) && jf(l, t),
          (n = e.createElement("script")),
          nl(n),
          dt(n, "link", l),
          e.head.appendChild(n)),
        (n = { type: "script", instance: n, count: 1, state: null }),
        a.set(u, n));
    }
  }
  function Gh(l, t) {
    je.M(l, t);
    var e = su;
    if (e && l) {
      var a = $t(e).hoistableScripts,
        u = du(l),
        n = a.get(u);
      n ||
        ((n = e.querySelector(fn(u))),
        n ||
          ((l = j({ src: l, async: !0, type: "module" }, t)),
          (t = Kt.get(u)) && jf(l, t),
          (n = e.createElement("script")),
          nl(n),
          dt(n, "link", l),
          e.head.appendChild(n)),
        (n = { type: "script", instance: n, count: 1, state: null }),
        a.set(u, n));
    }
  }
  function mr(l, t, e, a) {
    var u = (u = ll.current) ? vi(u) : null;
    if (!u) throw Error(h(446));
    switch (l) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof e.precedence == "string" && typeof e.href == "string"
          ? ((t = ru(e.href)),
            (e = $t(u).hoistableStyles),
            (a = e.get(t)),
            a ||
              ((a = { type: "style", instance: null, count: 0, state: null }),
              e.set(t, a)),
            a)
          : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (
          e.rel === "stylesheet" &&
          typeof e.href == "string" &&
          typeof e.precedence == "string"
        ) {
          l = ru(e.href);
          var n = $t(u).hoistableStyles,
            i = n.get(l);
          if (
            (i ||
              ((u = u.ownerDocument || u),
              (i = {
                type: "stylesheet",
                instance: null,
                count: 0,
                state: { loading: 0, preload: null },
              }),
              n.set(l, i),
              (n = u.querySelector(cn(l))) &&
                !n._p &&
                ((i.instance = n), (i.state.loading = 5)),
              Kt.has(l) ||
                ((e = {
                  rel: "preload",
                  as: "style",
                  href: e.href,
                  crossOrigin: e.crossOrigin,
                  integrity: e.integrity,
                  media: e.media,
                  hrefLang: e.hrefLang,
                  referrerPolicy: e.referrerPolicy,
                }),
                Kt.set(l, e),
                n || Qh(u, l, e, i.state))),
            t && a === null)
          )
            throw Error(h(528, ""));
          return i;
        }
        if (t && a !== null) throw Error(h(529, ""));
        return null;
      case "script":
        return (
          (t = e.async),
          (e = e.src),
          typeof e == "string" &&
          t &&
          typeof t != "function" &&
          typeof t != "symbol"
            ? ((t = du(e)),
              (e = $t(u).hoistableScripts),
              (a = e.get(t)),
              a ||
                ((a = {
                  type: "script",
                  instance: null,
                  count: 0,
                  state: null,
                }),
                e.set(t, a)),
              a)
            : { type: "void", instance: null, count: 0, state: null }
        );
      default:
        throw Error(h(444, l));
    }
  }
  function ru(l) {
    return 'href="' + qt(l) + '"';
  }
  function cn(l) {
    return 'link[rel="stylesheet"][' + l + "]";
  }
  function gr(l) {
    return j({}, l, { "data-precedence": l.precedence, precedence: null });
  }
  function Qh(l, t, e, a) {
    l.querySelector('link[rel="preload"][as="style"][' + t + "]")
      ? (a.loading = 1)
      : ((t = l.createElement("link")),
        (a.preload = t),
        t.addEventListener("load", function () {
          return (a.loading |= 1);
        }),
        t.addEventListener("error", function () {
          return (a.loading |= 2);
        }),
        dt(t, "link", e),
        nl(t),
        l.head.appendChild(t));
  }
  function du(l) {
    return '[src="' + qt(l) + '"]';
  }
  function fn(l) {
    return "script[async]" + l;
  }
  function vr(l, t, e) {
    if ((t.count++, t.instance === null))
      switch (t.type) {
        case "style":
          var a = l.querySelector('style[data-href~="' + qt(e.href) + '"]');
          if (a) return ((t.instance = a), nl(a), a);
          var u = j({}, e, {
            "data-href": e.href,
            "data-precedence": e.precedence,
            href: null,
            precedence: null,
          });
          return (
            (a = (l.ownerDocument || l).createElement("style")),
            nl(a),
            dt(a, "style", u),
            Si(a, e.precedence, l),
            (t.instance = a)
          );
        case "stylesheet":
          u = ru(e.href);
          var n = l.querySelector(cn(u));
          if (n) return ((t.state.loading |= 4), (t.instance = n), nl(n), n);
          ((a = gr(e)),
            (u = Kt.get(u)) && Uf(a, u),
            (n = (l.ownerDocument || l).createElement("link")),
            nl(n));
          var i = n;
          return (
            (i._p = new Promise(function (c, o) {
              ((i.onload = c), (i.onerror = o));
            })),
            dt(n, "link", a),
            (t.state.loading |= 4),
            Si(n, e.precedence, l),
            (t.instance = n)
          );
        case "script":
          return (
            (n = du(e.src)),
            (u = l.querySelector(fn(n)))
              ? ((t.instance = u), nl(u), u)
              : ((a = e),
                (u = Kt.get(n)) && ((a = j({}, e)), jf(a, u)),
                (l = l.ownerDocument || l),
                (u = l.createElement("script")),
                nl(u),
                dt(u, "link", a),
                l.head.appendChild(u),
                (t.instance = u))
          );
        case "void":
          return null;
        default:
          throw Error(h(443, t.type));
      }
    else
      t.type === "stylesheet" &&
        (t.state.loading & 4) === 0 &&
        ((a = t.instance), (t.state.loading |= 4), Si(a, e.precedence, l));
    return t.instance;
  }
  function Si(l, t, e) {
    for (
      var a = e.querySelectorAll(
          'link[rel="stylesheet"][data-precedence],style[data-precedence]',
        ),
        u = a.length ? a[a.length - 1] : null,
        n = u,
        i = 0;
      i < a.length;
      i++
    ) {
      var c = a[i];
      if (c.dataset.precedence === t) n = c;
      else if (n !== u) break;
    }
    n
      ? n.parentNode.insertBefore(l, n.nextSibling)
      : ((t = e.nodeType === 9 ? e.head : e), t.insertBefore(l, t.firstChild));
  }
  function Uf(l, t) {
    (l.crossOrigin == null && (l.crossOrigin = t.crossOrigin),
      l.referrerPolicy == null && (l.referrerPolicy = t.referrerPolicy),
      l.title == null && (l.title = t.title));
  }
  function jf(l, t) {
    (l.crossOrigin == null && (l.crossOrigin = t.crossOrigin),
      l.referrerPolicy == null && (l.referrerPolicy = t.referrerPolicy),
      l.integrity == null && (l.integrity = t.integrity));
  }
  var bi = null;
  function Sr(l, t, e) {
    if (bi === null) {
      var a = new Map(),
        u = (bi = new Map());
      u.set(e, a);
    } else ((u = bi), (a = u.get(e)), a || ((a = new Map()), u.set(e, a)));
    if (a.has(l)) return a;
    for (
      a.set(l, null), e = e.getElementsByTagName(l), u = 0;
      u < e.length;
      u++
    ) {
      var n = e[u];
      if (
        !(
          n[Jl] ||
          n[lt] ||
          (l === "link" && n.getAttribute("rel") === "stylesheet")
        ) &&
        n.namespaceURI !== "http://www.w3.org/2000/svg"
      ) {
        var i = n.getAttribute(t) || "";
        i = l + i;
        var c = a.get(i);
        c ? c.push(n) : a.set(i, [n]);
      }
    }
    return a;
  }
  function br(l, t, e) {
    ((l = l.ownerDocument || l),
      l.head.insertBefore(
        e,
        t === "title" ? l.querySelector("head > title") : null,
      ));
  }
  function Lh(l, t, e) {
    if (e === 1 || t.itemProp != null) return !1;
    switch (l) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (
          typeof t.precedence != "string" ||
          typeof t.href != "string" ||
          t.href === ""
        )
          break;
        return !0;
      case "link":
        if (
          typeof t.rel != "string" ||
          typeof t.href != "string" ||
          t.href === "" ||
          t.onLoad ||
          t.onError
        )
          break;
        return t.rel === "stylesheet"
          ? ((l = t.disabled), typeof t.precedence == "string" && l == null)
          : !0;
      case "script":
        if (
          t.async &&
          typeof t.async != "function" &&
          typeof t.async != "symbol" &&
          !t.onLoad &&
          !t.onError &&
          t.src &&
          typeof t.src == "string"
        )
          return !0;
    }
    return !1;
  }
  function pr(l) {
    return !(l.type === "stylesheet" && (l.state.loading & 3) === 0);
  }
  function Zh(l, t, e, a) {
    if (
      e.type === "stylesheet" &&
      (typeof a.media != "string" || matchMedia(a.media).matches !== !1) &&
      (e.state.loading & 4) === 0
    ) {
      if (e.instance === null) {
        var u = ru(a.href),
          n = t.querySelector(cn(u));
        if (n) {
          ((t = n._p),
            t !== null &&
              typeof t == "object" &&
              typeof t.then == "function" &&
              (l.count++, (l = pi.bind(l)), t.then(l, l)),
            (e.state.loading |= 4),
            (e.instance = n),
            nl(n));
          return;
        }
        ((n = t.ownerDocument || t),
          (a = gr(a)),
          (u = Kt.get(u)) && Uf(a, u),
          (n = n.createElement("link")),
          nl(n));
        var i = n;
        ((i._p = new Promise(function (c, o) {
          ((i.onload = c), (i.onerror = o));
        })),
          dt(n, "link", a),
          (e.instance = n));
      }
      (l.stylesheets === null && (l.stylesheets = new Map()),
        l.stylesheets.set(e, t),
        (t = e.state.preload) &&
          (e.state.loading & 3) === 0 &&
          (l.count++,
          (e = pi.bind(l)),
          t.addEventListener("load", e),
          t.addEventListener("error", e)));
    }
  }
  var Cf = 0;
  function Vh(l, t) {
    return (
      l.stylesheets && l.count === 0 && zi(l, l.stylesheets),
      0 < l.count || 0 < l.imgCount
        ? function (e) {
            var a = setTimeout(function () {
              if ((l.stylesheets && zi(l, l.stylesheets), l.unsuspend)) {
                var n = l.unsuspend;
                ((l.unsuspend = null), n());
              }
            }, 6e4 + t);
            0 < l.imgBytes && Cf === 0 && (Cf = 62500 * Ah());
            var u = setTimeout(
              function () {
                if (
                  ((l.waitingForImages = !1),
                  l.count === 0 &&
                    (l.stylesheets && zi(l, l.stylesheets), l.unsuspend))
                ) {
                  var n = l.unsuspend;
                  ((l.unsuspend = null), n());
                }
              },
              (l.imgBytes > Cf ? 50 : 800) + t,
            );
            return (
              (l.unsuspend = e),
              function () {
                ((l.unsuspend = null), clearTimeout(a), clearTimeout(u));
              }
            );
          }
        : null
    );
  }
  function pi() {
    if (
      (this.count--,
      this.count === 0 && (this.imgCount === 0 || !this.waitingForImages))
    ) {
      if (this.stylesheets) zi(this, this.stylesheets);
      else if (this.unsuspend) {
        var l = this.unsuspend;
        ((this.unsuspend = null), l());
      }
    }
  }
  var Ti = null;
  function zi(l, t) {
    ((l.stylesheets = null),
      l.unsuspend !== null &&
        (l.count++,
        (Ti = new Map()),
        t.forEach(Jh, l),
        (Ti = null),
        pi.call(l)));
  }
  function Jh(l, t) {
    if (!(t.state.loading & 4)) {
      var e = Ti.get(l);
      if (e) var a = e.get(null);
      else {
        ((e = new Map()), Ti.set(l, e));
        for (
          var u = l.querySelectorAll(
              "link[data-precedence],style[data-precedence]",
            ),
            n = 0;
          n < u.length;
          n++
        ) {
          var i = u[n];
          (i.nodeName === "LINK" || i.getAttribute("media") !== "not all") &&
            (e.set(i.dataset.precedence, i), (a = i));
        }
        a && e.set(null, a);
      }
      ((u = t.instance),
        (i = u.getAttribute("data-precedence")),
        (n = e.get(i) || a),
        n === a && e.set(null, u),
        e.set(i, u),
        this.count++,
        (a = pi.bind(this)),
        u.addEventListener("load", a),
        u.addEventListener("error", a),
        n
          ? n.parentNode.insertBefore(u, n.nextSibling)
          : ((l = l.nodeType === 9 ? l.head : l),
            l.insertBefore(u, l.firstChild)),
        (t.state.loading |= 4));
    }
  }
  var on = {
    $$typeof: Cl,
    Provider: null,
    Consumer: null,
    _currentValue: K,
    _currentValue2: K,
    _threadCount: 0,
  };
  function Kh(l, t, e, a, u, n, i, c, o) {
    ((this.tag = 1),
      (this.containerInfo = l),
      (this.pingCache = this.current = this.pendingChildren = null),
      (this.timeoutHandle = -1),
      (this.callbackNode =
        this.next =
        this.pendingContext =
        this.context =
        this.cancelPendingCommit =
          null),
      (this.callbackPriority = 0),
      (this.expirationTimes = Tu(-1)),
      (this.entangledLanes =
        this.shellSuspendCounter =
        this.errorRecoveryDisabledLanes =
        this.expiredLanes =
        this.warmLanes =
        this.pingedLanes =
        this.suspendedLanes =
        this.pendingLanes =
          0),
      (this.entanglements = Tu(0)),
      (this.hiddenUpdates = Tu(null)),
      (this.identifierPrefix = a),
      (this.onUncaughtError = u),
      (this.onCaughtError = n),
      (this.onRecoverableError = i),
      (this.pooledCache = null),
      (this.pooledCacheLanes = 0),
      (this.formState = o),
      (this.incompleteTransitions = new Map()));
  }
  function Tr(l, t, e, a, u, n, i, c, o, g, z, M) {
    return (
      (l = new Kh(l, t, e, i, o, g, z, M, c)),
      (t = 1),
      n === !0 && (t |= 24),
      (n = Ot(3, null, null, t)),
      (l.current = n),
      (n.stateNode = l),
      (t = rc()),
      t.refCount++,
      (l.pooledCache = t),
      t.refCount++,
      (n.memoizedState = { element: a, isDehydrated: e, cache: t }),
      mc(n),
      l
    );
  }
  function zr(l) {
    return l ? ((l = Za), l) : Za;
  }
  function Er(l, t, e, a, u, n) {
    ((u = zr(u)),
      a.context === null ? (a.context = u) : (a.pendingContext = u),
      (a = Ze(t)),
      (a.payload = { element: e }),
      (n = n === void 0 ? null : n),
      n !== null && (a.callback = n),
      (e = Ve(l, a, t)),
      e !== null && (Mt(e, l, t), Gu(e, l, t)));
  }
  function Ar(l, t) {
    if (((l = l.memoizedState), l !== null && l.dehydrated !== null)) {
      var e = l.retryLane;
      l.retryLane = e !== 0 && e < t ? e : t;
    }
  }
  function Hf(l, t) {
    (Ar(l, t), (l = l.alternate) && Ar(l, t));
  }
  function Mr(l) {
    if (l.tag === 13 || l.tag === 31) {
      var t = ga(l, 67108864);
      (t !== null && Mt(t, l, 67108864), Hf(l, 67108864));
    }
  }
  function xr(l) {
    if (l.tag === 13 || l.tag === 31) {
      var t = Ct();
      t = Ha(t);
      var e = ga(l, t);
      (e !== null && Mt(e, l, t), Hf(l, t));
    }
  }
  var Ei = !0;
  function wh(l, t, e, a) {
    var u = T.T;
    T.T = null;
    var n = D.p;
    try {
      ((D.p = 2), Bf(l, t, e, a));
    } finally {
      ((D.p = n), (T.T = u));
    }
  }
  function kh(l, t, e, a) {
    var u = T.T;
    T.T = null;
    var n = D.p;
    try {
      ((D.p = 8), Bf(l, t, e, a));
    } finally {
      ((D.p = n), (T.T = u));
    }
  }
  function Bf(l, t, e, a) {
    if (Ei) {
      var u = Nf(a);
      if (u === null) (Tf(l, t, a, Ai, e), Or(l, a));
      else if ($h(u, l, t, e, a)) a.stopPropagation();
      else if ((Or(l, a), t & 4 && -1 < Wh.indexOf(l))) {
        for (; u !== null; ) {
          var n = bt(u);
          if (n !== null)
            switch (n.tag) {
              case 3:
                if (((n = n.stateNode), n.current.memoizedState.isDehydrated)) {
                  var i = de(n.pendingLanes);
                  if (i !== 0) {
                    var c = n;
                    for (c.pendingLanes |= 2, c.entangledLanes |= 2; i; ) {
                      var o = 1 << (31 - mt(i));
                      ((c.entanglements[1] |= o), (i &= ~o));
                    }
                    (se(n), (Sl & 6) === 0 && ((ii = vl() + 500), en(0)));
                  }
                }
                break;
              case 31:
              case 13:
                ((c = ga(n, 2)), c !== null && Mt(c, n, 2), fi(), Hf(n, 2));
            }
          if (((n = Nf(a)), n === null && Tf(l, t, a, Ai, e), n === u)) break;
          u = n;
        }
        u !== null && a.stopPropagation();
      } else Tf(l, t, a, null, e);
    }
  }
  function Nf(l) {
    return ((l = Yi(l)), Yf(l));
  }
  var Ai = null;
  function Yf(l) {
    if (((Ai = null), (l = ne(l)), l !== null)) {
      var t = B(l);
      if (t === null) l = null;
      else {
        var e = t.tag;
        if (e === 13) {
          if (((l = U(t)), l !== null)) return l;
          l = null;
        } else if (e === 31) {
          if (((l = Z(t)), l !== null)) return l;
          l = null;
        } else if (e === 3) {
          if (t.stateNode.current.memoizedState.isDehydrated)
            return t.tag === 3 ? t.stateNode.containerInfo : null;
          l = null;
        } else t !== l && (l = null);
      }
    }
    return ((Ai = l), null);
  }
  function _r(l) {
    switch (l) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "resize":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (vu()) {
          case vn:
            return 2;
          case wt:
            return 8;
          case oa:
          case He:
            return 32;
          case Su:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var qf = !1,
    ta = null,
    ea = null,
    aa = null,
    sn = new Map(),
    rn = new Map(),
    ua = [],
    Wh =
      "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
        " ",
      );
  function Or(l, t) {
    switch (l) {
      case "focusin":
      case "focusout":
        ta = null;
        break;
      case "dragenter":
      case "dragleave":
        ea = null;
        break;
      case "mouseover":
      case "mouseout":
        aa = null;
        break;
      case "pointerover":
      case "pointerout":
        sn.delete(t.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        rn.delete(t.pointerId);
    }
  }
  function dn(l, t, e, a, u, n) {
    return l === null || l.nativeEvent !== n
      ? ((l = {
          blockedOn: t,
          domEventName: e,
          eventSystemFlags: a,
          nativeEvent: n,
          targetContainers: [u],
        }),
        t !== null && ((t = bt(t)), t !== null && Mr(t)),
        l)
      : ((l.eventSystemFlags |= a),
        (t = l.targetContainers),
        u !== null && t.indexOf(u) === -1 && t.push(u),
        l);
  }
  function $h(l, t, e, a, u) {
    switch (t) {
      case "focusin":
        return ((ta = dn(ta, l, t, e, a, u)), !0);
      case "dragenter":
        return ((ea = dn(ea, l, t, e, a, u)), !0);
      case "mouseover":
        return ((aa = dn(aa, l, t, e, a, u)), !0);
      case "pointerover":
        var n = u.pointerId;
        return (sn.set(n, dn(sn.get(n) || null, l, t, e, a, u)), !0);
      case "gotpointercapture":
        return (
          (n = u.pointerId),
          rn.set(n, dn(rn.get(n) || null, l, t, e, a, u)),
          !0
        );
    }
    return !1;
  }
  function Dr(l) {
    var t = ne(l.target);
    if (t !== null) {
      var e = B(t);
      if (e !== null) {
        if (((t = e.tag), t === 13)) {
          if (((t = U(e)), t !== null)) {
            ((l.blockedOn = t),
              ye(l.priority, function () {
                xr(e);
              }));
            return;
          }
        } else if (t === 31) {
          if (((t = Z(e)), t !== null)) {
            ((l.blockedOn = t),
              ye(l.priority, function () {
                xr(e);
              }));
            return;
          }
        } else if (t === 3 && e.stateNode.current.memoizedState.isDehydrated) {
          l.blockedOn = e.tag === 3 ? e.stateNode.containerInfo : null;
          return;
        }
      }
    }
    l.blockedOn = null;
  }
  function Mi(l) {
    if (l.blockedOn !== null) return !1;
    for (var t = l.targetContainers; 0 < t.length; ) {
      var e = Nf(l.nativeEvent);
      if (e === null) {
        e = l.nativeEvent;
        var a = new e.constructor(e.type, e);
        ((Ni = a), e.target.dispatchEvent(a), (Ni = null));
      } else return ((t = bt(e)), t !== null && Mr(t), (l.blockedOn = e), !1);
      t.shift();
    }
    return !0;
  }
  function Rr(l, t, e) {
    Mi(l) && e.delete(t);
  }
  function Fh() {
    ((qf = !1),
      ta !== null && Mi(ta) && (ta = null),
      ea !== null && Mi(ea) && (ea = null),
      aa !== null && Mi(aa) && (aa = null),
      sn.forEach(Rr),
      rn.forEach(Rr));
  }
  function xi(l, t) {
    l.blockedOn === t &&
      ((l.blockedOn = null),
      qf ||
        ((qf = !0),
        f.unstable_scheduleCallback(f.unstable_NormalPriority, Fh)));
  }
  var _i = null;
  function Ur(l) {
    _i !== l &&
      ((_i = l),
      f.unstable_scheduleCallback(f.unstable_NormalPriority, function () {
        _i === l && (_i = null);
        for (var t = 0; t < l.length; t += 3) {
          var e = l[t],
            a = l[t + 1],
            u = l[t + 2];
          if (typeof a != "function") {
            if (Yf(a || e) === null) continue;
            break;
          }
          var n = bt(e);
          n !== null &&
            (l.splice(t, 3),
            (t -= 3),
            Bc(n, { pending: !0, data: u, method: e.method, action: a }, a, u));
        }
      }));
  }
  function hu(l) {
    function t(o) {
      return xi(o, l);
    }
    (ta !== null && xi(ta, l),
      ea !== null && xi(ea, l),
      aa !== null && xi(aa, l),
      sn.forEach(t),
      rn.forEach(t));
    for (var e = 0; e < ua.length; e++) {
      var a = ua[e];
      a.blockedOn === l && (a.blockedOn = null);
    }
    for (; 0 < ua.length && ((e = ua[0]), e.blockedOn === null); )
      (Dr(e), e.blockedOn === null && ua.shift());
    if (((e = (l.ownerDocument || l).$$reactFormReplay), e != null))
      for (a = 0; a < e.length; a += 3) {
        var u = e[a],
          n = e[a + 1],
          i = u[ht] || null;
        if (typeof n == "function") i || Ur(e);
        else if (i) {
          var c = null;
          if (n && n.hasAttribute("formAction")) {
            if (((u = n), (i = n[ht] || null))) c = i.formAction;
            else if (Yf(u) !== null) continue;
          } else c = i.action;
          (typeof c == "function" ? (e[a + 1] = c) : (e.splice(a, 3), (a -= 3)),
            Ur(e));
        }
      }
  }
  function jr() {
    function l(n) {
      n.canIntercept &&
        n.info === "react-transition" &&
        n.intercept({
          handler: function () {
            return new Promise(function (i) {
              return (u = i);
            });
          },
          focusReset: "manual",
          scroll: "manual",
        });
    }
    function t() {
      (u !== null && (u(), (u = null)), a || setTimeout(e, 20));
    }
    function e() {
      if (!a && !navigation.transition) {
        var n = navigation.currentEntry;
        n &&
          n.url != null &&
          navigation.navigate(n.url, {
            state: n.getState(),
            info: "react-transition",
            history: "replace",
          });
      }
    }
    if (typeof navigation == "object") {
      var a = !1,
        u = null;
      return (
        navigation.addEventListener("navigate", l),
        navigation.addEventListener("navigatesuccess", t),
        navigation.addEventListener("navigateerror", t),
        setTimeout(e, 100),
        function () {
          ((a = !0),
            navigation.removeEventListener("navigate", l),
            navigation.removeEventListener("navigatesuccess", t),
            navigation.removeEventListener("navigateerror", t),
            u !== null && (u(), (u = null)));
        }
      );
    }
  }
  function Xf(l) {
    this._internalRoot = l;
  }
  ((Oi.prototype.render = Xf.prototype.render =
    function (l) {
      var t = this._internalRoot;
      if (t === null) throw Error(h(409));
      var e = t.current,
        a = Ct();
      Er(e, a, l, t, null, null);
    }),
    (Oi.prototype.unmount = Xf.prototype.unmount =
      function () {
        var l = this._internalRoot;
        if (l !== null) {
          this._internalRoot = null;
          var t = l.containerInfo;
          (Er(l.current, 2, null, l, null, null), fi(), (t[Ne] = null));
        }
      }));
  function Oi(l) {
    this._internalRoot = l;
  }
  Oi.prototype.unstable_scheduleHydration = function (l) {
    if (l) {
      var t = he();
      l = { blockedOn: null, target: l, priority: t };
      for (var e = 0; e < ua.length && t !== 0 && t < ua[e].priority; e++);
      (ua.splice(e, 0, l), e === 0 && Dr(l));
    }
  };
  var Cr = Q.version;
  if (Cr !== "19.2.4") throw Error(h(527, Cr, "19.2.4"));
  D.findDOMNode = function (l) {
    var t = l._reactInternals;
    if (t === void 0)
      throw typeof l.render == "function"
        ? Error(h(188))
        : ((l = Object.keys(l).join(",")), Error(h(268, l)));
    return (
      (l = p(t)),
      (l = l !== null ? q(l) : null),
      (l = l === null ? null : l.stateNode),
      l
    );
  };
  var Ih = {
    bundleType: 0,
    version: "19.2.4",
    rendererPackageName: "react-dom",
    currentDispatcherRef: T,
    reconcilerVersion: "19.2.4",
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var Di = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!Di.isDisabled && Di.supportsFiber)
      try {
        ((Be = Di.inject(Ih)), (Ul = Di));
      } catch {}
  }
  return (
    (yn.createRoot = function (l, t) {
      if (!R(l)) throw Error(h(299));
      var e = !1,
        a = "",
        u = Gs,
        n = Qs,
        i = Ls;
      return (
        t != null &&
          (t.unstable_strictMode === !0 && (e = !0),
          t.identifierPrefix !== void 0 && (a = t.identifierPrefix),
          t.onUncaughtError !== void 0 && (u = t.onUncaughtError),
          t.onCaughtError !== void 0 && (n = t.onCaughtError),
          t.onRecoverableError !== void 0 && (i = t.onRecoverableError)),
        (t = Tr(l, 1, !1, null, null, e, a, null, u, n, i, jr)),
        (l[Ne] = t.current),
        pf(l),
        new Xf(t)
      );
    }),
    (yn.hydrateRoot = function (l, t, e) {
      if (!R(l)) throw Error(h(299));
      var a = !1,
        u = "",
        n = Gs,
        i = Qs,
        c = Ls,
        o = null;
      return (
        e != null &&
          (e.unstable_strictMode === !0 && (a = !0),
          e.identifierPrefix !== void 0 && (u = e.identifierPrefix),
          e.onUncaughtError !== void 0 && (n = e.onUncaughtError),
          e.onCaughtError !== void 0 && (i = e.onCaughtError),
          e.onRecoverableError !== void 0 && (c = e.onRecoverableError),
          e.formState !== void 0 && (o = e.formState)),
        (t = Tr(l, 1, !0, t, e ?? null, a, u, o, n, i, c, jr)),
        (t.context = zr(null)),
        (e = t.current),
        (a = Ct()),
        (a = Ha(a)),
        (u = Ze(a)),
        (u.callback = null),
        Ve(e, u, a),
        (e = a),
        (t.current.lanes = e),
        Wt(t, e),
        se(t),
        (l[Ne] = t.current),
        pf(l),
        new Oi(t)
      );
    }),
    (yn.version = "19.2.4"),
    yn
  );
}
var Zr;
function oy() {
  if (Zr) return Lf.exports;
  Zr = 1;
  function f() {
    if (
      !(
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" ||
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"
      )
    )
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(f);
      } catch (Q) {
        console.error(Q);
      }
  }
  return (f(), (Lf.exports = fy()), Lf.exports);
}
var sy = oy();
const ry = ly(sy),
  dy = ["Straight", "Staggered 60°", "Staggered 45°", "Radial", "Custom Angle"],
  Vr = [
    { name: "Custom", d: 5, pitchX: 8, pitchY: 8, pattern: "Straight" },
    {
      name: "Rv 2-4 (60° staggered)",
      d: 2,
      pitchX: 4,
      pitchY: 3.46,
      pattern: "Staggered 60°",
    },
    {
      name: "Rv 3-5 (60° staggered)",
      d: 3,
      pitchX: 5,
      pitchY: 4.33,
      pattern: "Staggered 60°",
    },
    {
      name: "Rv 5-8 (60° staggered)",
      d: 5,
      pitchX: 8,
      pitchY: 6.93,
      pattern: "Staggered 60°",
    },
    {
      name: "Rv 6-9 (60° staggered)",
      d: 6,
      pitchX: 9,
      pitchY: 7.79,
      pattern: "Staggered 60°",
    },
    {
      name: "Rv 8-12 (60° staggered)",
      d: 8,
      pitchX: 12,
      pitchY: 10.39,
      pattern: "Staggered 60°",
    },
    {
      name: "Rv 10-15 (60° staggered)",
      d: 10,
      pitchX: 15,
      pitchY: 12.99,
      pattern: "Staggered 60°",
    },
    {
      name: "Rg 5-8 (straight)",
      d: 5,
      pitchX: 8,
      pitchY: 8,
      pattern: "Straight",
    },
    {
      name: "Rg 3-5 (straight)",
      d: 3,
      pitchX: 5,
      pitchY: 5,
      pattern: "Straight",
    },
    {
      name: "Rg 10-14 (straight)",
      d: 10,
      pitchX: 14,
      pitchY: 14,
      pattern: "Straight",
    },
    {
      name: "Rv 4-6 (45° staggered)",
      d: 4,
      pitchX: 6,
      pitchY: 6,
      pattern: "Staggered 45°",
    },
  ],
  yu = (f, Q, x) => Math.max(Q, Math.min(x, f));
function wf(f, Q, x) {
  return Q <= 0 || x <= 0 ? f : f - 2 * Q * Math.tan((x * Math.PI) / 180);
}
function hy(f) {
  const {
      diameter: Q,
      patternType: x,
      pitchX: h,
      pitchY: R,
      sheetW: B,
      sheetH: U,
      margin: Z,
      customAngle: O,
      ringSpacing: p,
      circumSpacing: q,
      numRings: j,
      holesPerRing: Y,
      centerHole: pl,
    } = f,
    V = Q / 2,
    fl = [],
    H = Z,
    Ol = B - Z,
    Zl = Z,
    Cl = U - Z;
  if (H >= Ol || Zl >= Cl) return fl;
  if (x === "Radial") {
    const W = B / 2,
      ol = U / 2;
    pl &&
      W >= H - V &&
      W <= Ol + V &&
      ol >= Zl - V &&
      ol <= Cl + V &&
      fl.push({ x: W, y: ol });
    const it = j || Math.floor(Math.max(B, U) / 2 / p);
    for (let Pl = 1; Pl <= it; Pl++) {
      const Tl = Pl * p,
        at = Y || Math.max(1, Math.floor((2 * Math.PI * Tl) / q));
      for (let el = 0; el < at; el++) {
        const Dl = (2 * Math.PI * el) / at,
          T = W + Tl * Math.cos(Dl),
          D = ol + Tl * Math.sin(Dl);
        T >= H - V &&
          T <= Ol + V &&
          D >= Zl - V &&
          D <= Cl + V &&
          fl.push({ x: T, y: D });
      }
    }
    return fl;
  }
  let Hl = () => 0;
  if (x === "Staggered 60°" || x === "Staggered 45°")
    Hl = (W) => (W % 2 === 1 ? h / 2 : 0);
  else if (x === "Custom Angle") {
    const W = (O * Math.PI) / 180;
    Hl = (ol) => (ol % 2 === 1 ? R * Math.tan(W) : 0);
  }
  let Vl = R;
  x === "Staggered 60°"
    ? (Vl = (h * Math.sqrt(3)) / 2)
    : x === "Staggered 45°" && (Vl = h);
  let ul = 0,
    G = Zl;
  for (; G <= Cl + V; ) {
    let W = H + Hl(ul);
    for (; W <= Ol + V; ) (fl.push({ x: W, y: G }), (W += h));
    ((G += Vl), ul++);
  }
  return fl;
}
function yy(f, Q) {
  const x = new Set();
  if (f.length > 1e4) return x;
  const h = Q,
    R = {};
  return (
    f.forEach((B, U) => {
      const Z = `${Math.floor(B.x / h)},${Math.floor(B.y / h)}`;
      (R[Z] ||= []).push(U);
    }),
    f.forEach((B, U) => {
      const Z = Math.floor(B.x / h),
        O = Math.floor(B.y / h);
      for (let p = -1; p <= 1; p++)
        for (let q = -1; q <= 1; q++)
          for (const j of R[`${Z + p},${O + q}`] || [])
            j > U &&
              Math.hypot(B.x - f[j].x, B.y - f[j].y) < Q - 0.001 &&
              (x.add(U), x.add(j));
    }),
    x
  );
}
function my(f, Q) {
  if (f.length < 2 || f.length > 1e4) return null;
  let x = 1 / 0;
  const h = Q * 2,
    R = {};
  return (
    f.forEach((B, U) => {
      const Z = `${Math.floor(B.x / h)},${Math.floor(B.y / h)}`;
      (R[Z] ||= []).push(U);
    }),
    f.forEach((B, U) => {
      const Z = Math.floor(B.x / h),
        O = Math.floor(B.y / h);
      for (let p = -1; p <= 1; p++)
        for (let q = -1; q <= 1; q++)
          for (const j of R[`${Z + p},${O + q}`] || [])
            if (j > U) {
              const Y = Math.hypot(B.x - f[j].x, B.y - f[j].y);
              Y < x && (x = Y);
            }
    }),
    x === 1 / 0 ? null : Math.max(0, x - Q)
  );
}
function Jr(f, Q, x, h) {
  const R = Math.PI * (Q / 2) ** 2;
  let B;
  return (
    f === "Staggered 60°"
      ? (B = x * ((x * Math.sqrt(3)) / 2))
      : f === "Staggered 45°"
        ? (B = x * x)
        : (B = x * h),
    B <= 0 ? 0 : Math.min((R / B) * 100, 100)
  );
}
function gy(f, Q) {
  const {
      diameter: x,
      sheetW: h,
      sheetH: R,
      thickness: B,
      taperAngle: U,
      taperDirection: Z,
    } = Q,
    O = x / 2,
    p = B > 0 && U > 0,
    q = Math.max(0, wf(x, B, U)),
    j = q / 2;
  let Y = `<svg xmlns="http://www.w3.org/2000/svg" width="${h}mm" height="${R}mm" viewBox="0 0 ${h} ${R}">
`;
  if (
    ((Y += `  <rect width="${h}" height="${R}" fill="#c0c0c0" />
`),
    p && q > 0)
  ) {
    const pl = Z === "Top larger" ? O : j,
      V = Z === "Top larger" ? j : O;
    ((Y += `  <g id="entry-side" data-description="Entry side (${(pl * 2).toFixed(3)}mm)">
`),
      f.forEach((fl) => {
        Y += `    <circle cx="${fl.x.toFixed(3)}" cy="${fl.y.toFixed(3)}" r="${pl.toFixed(3)}" fill="#000" />
`;
      }),
      (Y += `  </g>
  <g id="exit-side" data-description="Exit side (${(V * 2).toFixed(3)}mm)">
`),
      f.forEach((fl) => {
        Y += `    <circle cx="${fl.x.toFixed(3)}" cy="${fl.y.toFixed(3)}" r="${V.toFixed(3)}" fill="none" stroke="#666" stroke-width="0.15" stroke-dasharray="0.5,0.3" />
`;
      }),
      (Y += `  </g>
`));
  } else
    f.forEach((pl) => {
      Y += `  <circle cx="${pl.x.toFixed(3)}" cy="${pl.y.toFixed(3)}" r="${O.toFixed(3)}" fill="#000" />
`;
    });
  return Y + "</svg>";
}
function vy(f, Q, x, h, R, B, U) {
  const { diameter: Z, thickness: O, taperAngle: p, taperDirection: q } = B;
  if (O <= 0 || p <= 0) return;
  const j = Math.max(0, wf(Z, O, p));
  (f.save(),
    f.translate(Q, x),
    (f.fillStyle = U ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.88)"),
    (f.strokeStyle = U ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"),
    (f.lineWidth = 1),
    f.beginPath(),
    f.roundRect(0, 0, h, R, 6),
    f.fill(),
    f.stroke(),
    (f.fillStyle = U ? "#888" : "#666"),
    (f.font = "9px 'JetBrains Mono', monospace"),
    (f.textAlign = "left"),
    f.fillText("SECTION VIEW", 8, 14));
  const Y = 40,
    pl = 20,
    V = 24,
    fl = 20,
    H = Y + (h - Y - pl) / 2,
    Ol = V + (R - V - fl) / 2,
    Zl = Math.min((h - Y - pl) / (Z * 1.6), (R - V - fl) / (O * 1.5)),
    Cl = (Z / 2) * Zl,
    Hl = (j / 2) * Zl,
    Vl = O * Zl,
    ul = q === "Top larger" ? Cl : Hl,
    G = q === "Top larger" ? Hl : Cl,
    W = Ol - Vl / 2,
    ol = Ol + Vl / 2;
  ((f.fillStyle = U ? "#3a3a42" : "#b8b8c0"),
    [
      [-1, -14],
      [1, 14],
    ].forEach(([el, Dl]) => {
      (f.beginPath(),
        f.moveTo(H + el * (ul + Math.abs(Dl)), W),
        f.lineTo(H + el * ul, W),
        f.lineTo(H + el * G, ol),
        f.lineTo(H + el * (G + Math.abs(Dl)), ol),
        f.closePath(),
        f.fill());
    }),
    (f.fillStyle = U ? "#0f0f11" : "#e8e8ec"),
    f.beginPath(),
    f.moveTo(H - ul, W),
    f.lineTo(H + ul, W),
    f.lineTo(H + G, ol),
    f.lineTo(H - G, ol),
    f.closePath(),
    f.fill(),
    (f.strokeStyle = U ? "#888" : "#555"),
    (f.lineWidth = 1),
    f.beginPath(),
    f.moveTo(H - ul, W),
    f.lineTo(H - G, ol),
    f.stroke(),
    f.beginPath(),
    f.moveTo(H + ul, W),
    f.lineTo(H + G, ol),
    f.stroke(),
    (f.strokeStyle = U ? "#666" : "#777"),
    (f.lineWidth = 0.5),
    f.beginPath(),
    f.moveTo(H - ul - 14, W),
    f.lineTo(H + ul + 14, W),
    f.stroke(),
    f.beginPath(),
    f.moveTo(H - G - 14, ol),
    f.lineTo(H + G + 14, ol),
    f.stroke());
  const it = U ? "#e8a040" : "#c06000",
    Pl = U ? "rgba(232,160,64,0.6)" : "rgba(192,96,0,0.5)";
  ((f.fillStyle = it),
    (f.strokeStyle = it),
    (f.font = "9px 'JetBrains Mono', monospace"),
    (f.lineWidth = 0.7));
  const Tl = W - 8;
  if (
    (f.beginPath(),
    f.moveTo(H - ul, Tl),
    f.lineTo(H + ul, Tl),
    f.stroke(),
    [H - ul, H + ul].forEach((el) => {
      (f.beginPath(), f.moveTo(el, Tl - 3), f.lineTo(el, Tl + 3), f.stroke());
    }),
    (f.globalAlpha = 0.3),
    [H - ul, H + ul].forEach((el) => {
      (f.beginPath(), f.moveTo(el, W), f.lineTo(el, Tl), f.stroke());
    }),
    (f.globalAlpha = 1),
    (f.textAlign = "center"),
    f.fillText(
      q === "Top larger" ? `d=${Z.toFixed(1)}` : `d_exit=${j.toFixed(1)}`,
      H,
      Tl - 3,
    ),
    j > 0 && Math.abs(j - Z) > 0.01)
  ) {
    const el = ol + 12;
    ((f.strokeStyle = Pl),
      (f.fillStyle = Pl),
      f.beginPath(),
      f.moveTo(H - G, el),
      f.lineTo(H + G, el),
      f.stroke(),
      [H - G, H + G].forEach((Dl) => {
        (f.beginPath(), f.moveTo(Dl, el - 3), f.lineTo(Dl, el + 3), f.stroke());
      }),
      (f.globalAlpha = 0.3),
      [H - G, H + G].forEach((Dl) => {
        (f.beginPath(), f.moveTo(Dl, ol), f.lineTo(Dl, el), f.stroke());
      }),
      (f.globalAlpha = 1),
      (f.textAlign = "center"),
      f.fillText(
        q === "Top larger" ? `d_exit=${j.toFixed(1)}` : `d=${Z.toFixed(1)}`,
        H,
        el + 11,
      ));
  } else
    j <= 0 &&
      ((f.fillStyle = "#ef4444"),
      (f.textAlign = "center"),
      f.fillText("CLOSED", H, ol + 14));
  ((f.strokeStyle = it), (f.fillStyle = it));
  const at = H + Math.max(ul, G) + 20;
  if (
    (f.beginPath(),
    f.moveTo(at, W),
    f.lineTo(at, ol),
    f.stroke(),
    [W, ol].forEach((el) => {
      (f.beginPath(), f.moveTo(at - 3, el), f.lineTo(at + 3, el), f.stroke());
    }),
    f.save(),
    f.translate(at + 10, Ol),
    f.rotate(-Math.PI / 2),
    (f.textAlign = "center"),
    f.fillText(`t=${O.toFixed(1)}`, 0, 0),
    f.restore(),
    p > 0.5)
  ) {
    ((f.strokeStyle = U ? "#8bc5f8" : "#4488cc"),
      (f.fillStyle = U ? "#8bc5f8" : "#4488cc"),
      (f.lineWidth = 0.7));
    const el = Math.min(20, Vl * 0.6),
      Dl = Math.atan2(ul - G, Vl);
    (f.beginPath(),
      f.arc(H - G, ol, el, -Math.PI / 2, -Math.PI / 2 + Dl, !1),
      f.stroke(),
      (f.font = "8px 'JetBrains Mono', monospace"),
      (f.textAlign = "right"),
      f.fillText(`θ=${p.toFixed(1)}°`, H - G - 3, ol - el * 0.4));
  }
  ((f.fillStyle = U ? "#666" : "#999"),
    (f.font = "8px 'JetBrains Mono', monospace"),
    (f.textAlign = "right"),
    f.fillText(q === "Top larger" ? "ENTRY ▸" : "EXIT ▸", Y - 4, W + 4),
    f.fillText(q === "Top larger" ? "EXIT ▸" : "ENTRY ▸", Y - 4, ol + 4),
    f.restore());
}
function Sy({ value: f, nominalValue: Q, dark: x }) {
  const U = 94 * Math.PI,
    Z = U * 0.75,
    O = Z - (yu(f, 0, 100) / 100) * Z,
    p = Q != null && Math.abs(Q - f) > 0.01,
    q = p ? Z - (yu(Q, 0, 100) / 100) * Z : 0,
    j = x ? "#60a5fa" : "#2563eb";
  return S.jsxs("svg", {
    width: 108,
    height: 108,
    viewBox: "0 0 108 108",
    style: { display: "block", margin: "0 auto" },
    children: [
      S.jsx("circle", {
        cx: 54,
        cy: 54,
        r: 47,
        fill: "none",
        stroke: x ? "#2a2a2e" : "#e2e2e8",
        strokeWidth: 7,
        strokeDasharray: `${Z} ${U}`,
        strokeLinecap: "round",
        transform: "rotate(135 54 54)",
      }),
      p &&
        S.jsx("circle", {
          cx: 54,
          cy: 54,
          r: 47,
          fill: "none",
          stroke: x ? "rgba(96,165,250,0.2)" : "rgba(37,99,235,0.15)",
          strokeWidth: 7,
          strokeDasharray: `${Z} ${U}`,
          strokeDashoffset: q,
          strokeLinecap: "round",
          transform: "rotate(135 54 54)",
          style: { transition: "stroke-dashoffset 0.2s" },
        }),
      S.jsx("circle", {
        cx: 54,
        cy: 54,
        r: 47,
        fill: "none",
        stroke: j,
        strokeWidth: 7,
        strokeDasharray: `${Z} ${U}`,
        strokeDashoffset: O,
        strokeLinecap: "round",
        transform: "rotate(135 54 54)",
        style: { transition: "stroke-dashoffset 0.2s" },
      }),
      S.jsx("text", {
        x: 54,
        y: 50,
        textAnchor: "middle",
        fill: x ? "#f0f0f0" : "#111",
        fontSize: "22",
        fontWeight: "600",
        fontFamily: "'JetBrains Mono', monospace",
        children: f.toFixed(1),
      }),
      S.jsx("text", {
        x: 54,
        y: 68,
        textAnchor: "middle",
        fill: x ? "#888" : "#666",
        fontSize: "11",
        fontFamily: "'JetBrains Mono', monospace",
        children: "% Open",
      }),
    ],
  });
}
function xt({
  label: f,
  value: Q,
  min: x,
  max: h,
  step: R,
  onChange: B,
  unit: U,
  dark: Z,
}) {
  const [O, p] = k.useState(String(Q)),
    q = k.useRef(null),
    j = k.useRef(!1);
  k.useEffect(() => {
    j.current || p(String(Q));
  }, [Q]);
  const Y = () => {
      j.current = !1;
      const H = parseFloat(O);
      if (isNaN(H)) {
        p(String(Q));
        return;
      }
      const Ol = yu(H, x, h);
      (B(Ol), p(String(Ol)));
    },
    pl = Z ? "#333" : "#d4d4d8",
    V = Z ? "#60a5fa" : "#2563eb",
    fl = ((Q - x) / (h - x)) * 100;
  return S.jsxs("div", {
    style: { marginBottom: 10 },
    children: [
      S.jsxs("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        },
        children: [
          S.jsx("span", {
            style: {
              fontSize: 11,
              color: Z ? "#ccc" : "#444",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: 0.3,
            },
            children: f,
          }),
          S.jsxs("div", {
            style: { display: "flex", alignItems: "center", gap: 3 },
            children: [
              S.jsx("input", {
                ref: q,
                type: "text",
                inputMode: "decimal",
                value: O,
                onFocus: () => {
                  ((j.current = !0), q.current?.select());
                },
                onBlur: Y,
                onKeyDown: (H) => {
                  H.key === "Enter" && (Y(), q.current?.blur());
                },
                onChange: (H) => p(H.target.value),
                style: {
                  width: 52,
                  height: 24,
                  fontSize: 11,
                  textAlign: "right",
                  background: Z ? "#1e1e22" : "#fff",
                  color: Z ? "#eee" : "#222",
                  border: `1px solid ${Z ? "#333" : "#d0d0d0"}`,
                  borderRadius: 4,
                  padding: "0 4px",
                  outline: "none",
                  fontFamily: "'JetBrains Mono', monospace",
                },
              }),
              U &&
                S.jsx("span", {
                  style: {
                    fontSize: 10,
                    color: Z ? "#666" : "#999",
                    fontFamily: "'JetBrains Mono', monospace",
                  },
                  children: U,
                }),
            ],
          }),
        ],
      }),
      S.jsx("input", {
        type: "range",
        min: x,
        max: h,
        step: R,
        value: Q,
        onChange: (H) => B(parseFloat(H.target.value)),
        style: {
          width: "100%",
          height: 4,
          appearance: "none",
          outline: "none",
          borderRadius: 2,
          cursor: "pointer",
          background: `linear-gradient(to right, ${V} 0%, ${V} ${fl}%, ${pl} ${fl}%, ${pl} 100%)`,
        },
      }),
    ],
  });
}
function by({ value: f, onChange: Q, dark: x }) {
  const h = x ? "#60a5fa" : "#2563eb";
  return S.jsx("div", {
    onClick: () => Q(!f),
    style: {
      width: 34,
      height: 18,
      borderRadius: 9,
      padding: 2,
      flexShrink: 0,
      cursor: "pointer",
      background: f ? h : x ? "#333" : "#ccc",
      transition: "background 0.2s",
      display: "flex",
      alignItems: "center",
    },
    children: S.jsx("div", {
      style: {
        width: 14,
        height: 14,
        borderRadius: 7,
        background: "#fff",
        transform: f ? "translateX(16px)" : "translateX(0)",
        transition: "transform 0.2s",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      },
    }),
  });
}
function mn({ label: f, value: Q, dark: x }) {
  const h = Q < 0;
  return S.jsxs("div", {
    style: {
      fontSize: 9,
      color: h ? "#ef4444" : x ? "#555" : "#aaa",
      marginTop: -6,
      marginBottom: 8,
      paddingLeft: 2,
      fontFamily: "'JetBrains Mono', monospace",
    },
    children: ["↔ ", f, ": ", Q.toFixed(2), " mm", h ? " (overlap)" : ""],
  });
}
function Kr({ linked: f, dark: Q }) {
  const x = f ? (Q ? "#60a5fa" : "#2563eb") : Q ? "#555" : "#aaa";
  return S.jsx("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    style: { display: "block" },
    children: f
      ? S.jsxs(S.Fragment, {
          children: [
            S.jsx("path", {
              d: "M6.5 9.5L9.5 6.5",
              stroke: x,
              strokeWidth: "1.3",
              strokeLinecap: "round",
            }),
            S.jsx("path", {
              d: "M9 5l1.5-1.5a2.12 2.12 0 0 1 3 3L12 8",
              stroke: x,
              strokeWidth: "1.3",
              strokeLinecap: "round",
            }),
            S.jsx("path", {
              d: "M7 11L5.5 12.5a2.12 2.12 0 0 1-3-3L4 8",
              stroke: x,
              strokeWidth: "1.3",
              strokeLinecap: "round",
            }),
          ],
        })
      : S.jsxs(S.Fragment, {
          children: [
            S.jsx("path", {
              d: "M9 5l1.5-1.5a2.12 2.12 0 0 1 3 3L12 8",
              stroke: x,
              strokeWidth: "1.3",
              strokeLinecap: "round",
            }),
            S.jsx("path", {
              d: "M7 11L5.5 12.5a2.12 2.12 0 0 1-3-3L4 8",
              stroke: x,
              strokeWidth: "1.3",
              strokeLinecap: "round",
            }),
            S.jsx("path", {
              d: "M5 3l6 10",
              stroke: x,
              strokeWidth: "1",
              strokeLinecap: "round",
              opacity: "0.5",
            }),
          ],
        }),
  });
}
function py() {
  const [f, Q] = k.useState(!0),
    [x, h] = k.useState(5),
    [R, B] = k.useState("Staggered 60°"),
    [U, Z] = k.useState(8),
    [O, p] = k.useState(8),
    [q, j] = k.useState(!0),
    [Y, pl] = k.useState(200),
    [V, fl] = k.useState(200),
    [H, Ol] = k.useState(0),
    [Zl, Cl] = k.useState(30),
    [Hl, Vl] = k.useState(10),
    [ul, G] = k.useState(10),
    [W, ol] = k.useState(!0),
    [it, Pl] = k.useState(0),
    [Tl, at] = k.useState(0),
    [el, Dl] = k.useState(!1),
    [zl, r] = k.useState(0),
    [A, C] = k.useState(0),
    [N, F] = k.useState(0),
    [ll, yl] = k.useState("Top larger"),
    kl = k.useRef(null),
    [Rl, ee] = k.useState({ x: 0, y: 0 }),
    [ae, Da] = k.useState(1),
    [Ra, ue] = k.useState(!1),
    ia = k.useRef({ x: 0, y: 0 }),
    ca = k.useRef({ x: 0, y: 0 }),
    fa = k.useRef(null),
    Ua = k.useCallback(
      (_) => {
        const _p = _ + x;
        (Z(_p), q && p(_p), r(0));
      },
      [q, x],
    ),
    mu = k.useCallback((_) => {
      (p(_ + x), r(0));
    }, [x]),
    gu = k.useCallback(
      (_) => {
        const _s = _ + x;
        (Vl(_s), W && G(_s));
      },
      [W, x],
    ),
    Ri = k.useCallback((_) => {
      G(_ + x);
    }, [x]),
    Ce = k.useMemo(
      () => ({
        diameter: x,
        patternType: R,
        pitchX: U,
        pitchY: O,
        sheetW: Y,
        sheetH: V,
        margin: H,
        customAngle: Zl,
        ringSpacing: Hl,
        circumSpacing: ul,
        numRings: it,
        holesPerRing: Tl,
        centerHole: el,
        thickness: A,
        taperAngle: N,
        taperDirection: ll,
      }),
      [x, R, U, O, Y, V, H, Zl, Hl, ul, it, Tl, el, A, N, ll],
    ),
    vl = k.useMemo(() => hy(Ce), [Ce]),
    vu = k.useMemo(() => yy(vl, x), [vl, x]),
    vn = vu.size > 0,
    wt = vl.length,
    oa = Math.PI * (x / 2) ** 2,
    He = Y * V,
    Su = R === "Radial",
    sa = He > 0 ? ((oa * wt) / He) * 100 : 0,
    ut = A > 0 && N > 0,
    Be = wf(x, A, N),
    Ul = Math.max(0, Be),
    Gl = Be <= 0,
    mt = Gl ? wt : 0,
    bu = He > 0 ? ((Math.PI * (Ul / 2) ** 2 * wt) / He) * 100 : 0,
    pu = ut ? bu - sa : 0,
    Ui = ut ? bu : sa,
    re = k.useMemo(() => my(vl, x), [vl, x]),
    kt = wt > 1e4,
    ja = k.useCallback((_) => {
      if ((r(_), _ === 0)) return;
      const d = Vr[_];
      (h(d.d), Z(d.pitchX), p(d.pitchY), B(d.pattern));
    }, []);
  (k.useEffect(() => {
    const _ = kl.current;
    if (!_) return;
    const d = _.getContext("2d"),
      ql = _.getBoundingClientRect(),
      Ht = window.devicePixelRatio || 1;
    ((_.width = ql.width * Ht),
      (_.height = ql.height * Ht),
      d.setTransform(Ht, 0, 0, Ht, 0, 0));
    const Jl = ql.width,
      ct = ql.height;
    ((d.fillStyle = f ? "#0f0f11" : "#e8e8ec"), d.fillRect(0, 0, Jl, ct));
    const bt = Math.min((Jl - 80) / Y, (ct - 80) / V) * ae,
      ie = Jl / 2 + Rl.x,
      $t = ct / 2 + Rl.y;
    (d.save(),
      d.translate(ie, $t),
      d.scale(bt, bt),
      d.translate(-Y / 2, -V / 2),
      (d.shadowColor = f ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)"),
      (d.shadowBlur = 20 / bt),
      (d.shadowOffsetX = 3 / bt),
      (d.shadowOffsetY = 3 / bt),
      (d.fillStyle = f ? "#3a3a40" : "#c8c8cd"),
      d.fillRect(0, 0, Y, V),
      (d.shadowColor = "transparent"),
      (d.fillStyle = f ? "#48484f" : "#d4d4da"),
      d.fillRect(0, 0, Y, V));
    H > 0 &&
      ((d.strokeStyle = f ? "rgba(100,160,250,0.15)" : "rgba(37,99,235,0.1)"),
      (d.lineWidth = 0.3),
      d.setLineDash([2, 2]),
      d.strokeRect(H, H, Y - H * 2, V - H * 2),
      d.setLineDash([]));
    const nl = x / 2,
      Ft = Ul / 2,
      Au = ut && !kt;
    (d.save(),
      d.beginPath(),
      d.rect(0, 0, Y, V),
      d.clip(),
      kt
        ? ((d.fillStyle = f ? "#0a0a0c" : "#1a1a1e"),
          vl.forEach((P) => {
            d.fillRect(P.x - nl * 0.7, P.y - nl * 0.7, nl * 1.4, nl * 1.4);
          }))
        : vl.forEach((P, tt) => {
            const me = vu.has(tt),
              $ = ut && Gl;
            if (
              (d.beginPath(),
              d.arc(P.x, P.y, nl, 0, Math.PI * 2),
              (d.fillStyle = $
                ? f
                  ? "rgba(220,50,50,0.55)"
                  : "rgba(200,30,30,0.45)"
                : me
                  ? f
                    ? "rgba(220,50,50,0.7)"
                    : "rgba(200,30,30,0.6)"
                  : f
                    ? "#0f0f11"
                    : "#1a1a1e"),
              d.fill(),
              Au &&
                !$ &&
                ((d.strokeStyle = f
                  ? "rgba(200,200,210,0.4)"
                  : "rgba(60,60,70,0.35)"),
                (d.lineWidth = 0.25),
                d.stroke()),
              !me && !$ && ae > 0.5 && !kt)
            ) {
              const ft = d.createRadialGradient(
                P.x - nl * 0.2,
                P.y - nl * 0.2,
                0,
                P.x,
                P.y,
                nl,
              );
              (ft.addColorStop(
                0,
                f ? "rgba(40,40,45,0.3)" : "rgba(60,60,65,0.2)",
              ),
                ft.addColorStop(1, "transparent"),
                d.beginPath(),
                d.arc(P.x, P.y, nl, 0, Math.PI * 2),
                (d.fillStyle = ft),
                d.fill());
            }
            Au &&
              Ul > 0 &&
              !$ &&
              (d.beginPath(),
              d.arc(P.x, P.y, Ft, 0, Math.PI * 2),
              (d.strokeStyle = f
                ? "rgba(96,165,250,0.5)"
                : "rgba(37,99,235,0.45)"),
              (d.lineWidth = 0.3),
              d.setLineDash([0.8, 0.6]),
              d.stroke(),
              d.setLineDash([]));
          }),
      d.restore());
    ((d.strokeStyle = f ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)"),
      (d.lineWidth = 0.5),
      d.strokeRect(0, 0, Y, V),
      d.restore());
    kt &&
      ((d.fillStyle = f ? "rgba(220,160,40,0.85)" : "rgba(180,120,20,0.9)"),
      (d.font = "11px 'JetBrains Mono', monospace"),
      (d.textAlign = "left"),
      d.fillText(
        `⚡ Performance mode (${wt.toLocaleString()} holes)`,
        12,
        ct - 12,
      ));
  }, [
    vl,
    vu,
    Ce,
    f,
    Rl,
    ae,
    kt,
    wt,
    x,
    U,
    O,
    R,
    H,
    Y,
    V,
    ut,
    Ul,
    Gl,
    A,
    N,
    ll,
  ]),
    k.useEffect(() => {
      const _ = kl.current;
      if (!_ || !fa.current) return;
      const d = new ResizeObserver(() => {
        ((_.style.width = fa.current.getBoundingClientRect().width + "px"),
          (_.style.height = fa.current.getBoundingClientRect().height + "px"),
          ee((ql) => ({ ...ql })));
      });
      return (d.observe(fa.current), () => d.disconnect());
    }, []));
  const de = k.useCallback((_) => {
      _.preventDefault();
      const d = kl.current;
      if (!d) return;
      const ql = d.getBoundingClientRect(),
        Ht = _.clientX - ql.left,
        Jl = _.clientY - ql.top,
        ct = ql.width / 2,
        ne = ql.height / 2,
        bt = _.deltaY > 0 ? 0.92 : 1.08;
      Da((ie) => {
        const $t = yu(ie * bt, 0.1, 20),
          nl = $t / ie;
        return (
          ee((Ft) => ({
            x: Ht - nl * (Ht - Ft.x - ct) - ct,
            y: Jl - nl * (Jl - Ft.y - ne) - ne,
          })),
          $t
        );
      });
    }, []),
    Ca = k.useCallback(
      (_) => {
        _.button === 0 &&
          (ue(!0),
          (ia.current = { x: _.clientX, y: _.clientY }),
          (ca.current = { ...Rl }),
          _.currentTarget.setPointerCapture(_.pointerId));
      },
      [Rl],
    ),
    ra = k.useCallback(
      (_) => {
        Ra &&
          ee({
            x: ca.current.x + (_.clientX - ia.current.x),
            y: ca.current.y + (_.clientY - ia.current.y),
          });
      },
      [Ra],
    ),
    Sn = k.useCallback(() => ue(!1), []),
    bn = k.useCallback(() => {
      const _ = new Blob([gy(vl, Ce)], { type: "image/svg+xml" }),
        d = document.createElement("a");
      ((d.href = URL.createObjectURL(_)),
        (d.download = "perforation_pattern.svg"),
        d.click());
    }, [vl, Ce]),
    Tu = k.useCallback(() => {
      const _ = document.createElement("canvas");
      ((_.width = Y * 8), (_.height = V * 8));
      const d = _.getContext("2d"),
        ql = Math.min(_.width / Y, _.height / V);
      ((d.fillStyle = f ? "#48484f" : "#d4d4da"),
        d.fillRect(0, 0, _.width, _.height),
        d.save(),
        d.scale(ql, ql));
      const Ht = x / 2;
      (vl.forEach((Jl) => {
        (d.beginPath(),
          d.arc(Jl.x, Jl.y, Ht, 0, Math.PI * 2),
          (d.fillStyle =
            ut && Gl ? "rgba(200,30,30,0.5)" : f ? "#0f0f11" : "#1a1a1e"),
          d.fill(),
          ut &&
            Ul > 0 &&
            !Gl &&
            (d.beginPath(),
            d.arc(Jl.x, Jl.y, Ul / 2, 0, Math.PI * 2),
            (d.strokeStyle = "rgba(96,165,250,0.5)"),
            (d.lineWidth = 0.3),
            d.setLineDash([0.8, 0.6]),
            d.stroke(),
            d.setLineDash([])));
      }),
        d.restore(),
        _.toBlob((Jl) => {
          const ct = document.createElement("a");
          ((ct.href = URL.createObjectURL(Jl)),
            (ct.download = "perforation_pattern.png"),
            ct.click());
        }));
    }, [vl, Y, V, x, f, ut, Gl, Ul]),
    Wt = f ? "#27272a" : "#e0e0e5",
    da = f ? "#e4e4e7" : "#18181b",
    Bl = "#71717a",
    zu = f ? "#222225" : "#ececf0",
    Eu = f ? "#1e1e22" : "#fafafa",
    Ha = f ? "#27272a" : "#e8e8ec",
    vt = f ? "#60a5fa" : "#2563eb",
    he = "#ef4444",
    ye = { padding: "12px 0", borderBottom: `1px solid ${zu}` },
    St = {
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      color: Bl,
      marginBottom: 10,
      fontFamily: "'JetBrains Mono', monospace",
    },
    lt = R === "Radial",
    ht = R === "Straight" || R === "Custom Angle",
    Ne = ({ label: _, active: d, onClick: ql }) =>
      S.jsx("button", {
        onClick: ql,
        style: {
          flex: 1,
          padding: "5px 6px",
          fontSize: 10,
          borderRadius: 4,
          border: `1px solid ${d ? vt : Wt}`,
          background: d
            ? f
              ? "rgba(96,165,250,0.15)"
              : "rgba(37,99,235,0.08)"
            : "transparent",
          color: d ? vt : Bl,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          transition: "all 0.15s",
        },
        children: _,
      });
  return S.jsxs("div", {
    style: {
      display: "flex",
      width: "100vw",
      height: "100vh",
      background: f ? "#111113" : "#f2f2f5",
      color: da,
      fontFamily: "'JetBrains Mono', -apple-system, sans-serif",
      overflow: "hidden",
    },
    children: [
      S.jsx("link", {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      }),
      S.jsx("link", {
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap",
        rel: "stylesheet",
      }),
      S.jsxs("div", {
        ref: fa,
        style: { flex: 1, position: "relative", overflow: "hidden" },
        children: [
          S.jsx("canvas", {
            ref: kl,
            style: {
              width: "100%",
              height: "100%",
              cursor: Ra ? "grabbing" : "grab",
            },
            onWheel: de,
            onPointerDown: Ca,
            onPointerMove: ra,
            onPointerUp: Sn,
            onPointerCancel: Sn,
          }),
          S.jsxs("div", {
            style: {
              position: "absolute",
              top: 12,
              left: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            },
            children: [
              S.jsxs("span", {
                style: {
                  fontSize: 10,
                  color: Bl,
                  background: f ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)",
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                  backdropFilter: "blur(8px)",
                },
                children: [ae.toFixed(1), "x"],
              }),
              vn &&
                S.jsx("span", {
                  style: {
                    fontSize: 10,
                    color: "#fff",
                    background: he,
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontFamily: "'JetBrains Mono', monospace",
                  },
                  children: "⚠ Holes overlap",
                }),
              ut &&
                Gl &&
                S.jsxs("span", {
                  style: {
                    fontSize: 10,
                    color: "#fff",
                    background: he,
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontFamily: "'JetBrains Mono', monospace",
                  },
                  children: ["⚠ ", mt, "/", wt, " holes closed"],
                }),
            ],
          }),
          S.jsx("button", {
            onClick: () => {
              (Da(1), ee({ x: 0, y: 0 }));
            },
            style: {
              position: "absolute",
              bottom: 12,
              left: 12,
              fontSize: 10,
              color: Bl,
              background: f ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)",
              padding: "4px 10px",
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              backdropFilter: "blur(8px)",
            },
            children: "Reset View",
          }),
        ],
      }),
      S.jsxs("div", {
        style: {
          width: 296,
          minWidth: 296,
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          background: f ? "#18181b" : "#ffffff",
          borderLeft: `1px solid ${Wt}`,
          padding: "0 16px",
          boxSizing: "border-box",
          scrollbarWidth: "thin",
          scrollbarColor: f ? "#333 transparent" : "#ccc transparent",
        },
        children: [
          S.jsxs("div", {
            style: {
              padding: "14px 0 8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${zu}`,
            },
            children: [
              S.jsxs("div", {
                children: [
                  S.jsx("div", {
                    style: {
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: -0.3,
                    },
                    children: "Perf Pattern",
                  }),
                  S.jsx("div", {
                    style: {
                      fontSize: 9,
                      color: Bl,
                      marginTop: 2,
                      letterSpacing: 0.5,
                    },
                    children: "CIRCULAR PERFORATION GENERATOR",
                  }),
                ],
              }),
              S.jsx("button", {
                onClick: () => Q((_) => !_),
                style: {
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: `1px solid ${Wt}`,
                  background: Eu,
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: da,
                },
                children: f ? "☀" : "☽",
              }),
            ],
          }),
          S.jsxs("div", {
            style: { ...ye, textAlign: "center" },
            children: [
              S.jsx(Sy, {
                value: yu(Ui, 0, 100),
                nominalValue: ut ? yu(sa, 0, 100) : null,
                dark: f,
              }),
              ut &&
                S.jsxs("div", {
                  style: {
                    margin: "8px 0 4px",
                    padding: "6px 8px",
                    borderRadius: 5,
                    background: f
                      ? "rgba(96,165,250,0.06)"
                      : "rgba(37,99,235,0.04)",
                    border: `1px solid ${f ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.1)"}`,
                    textAlign: "left",
                  },
                  children: [
                    S.jsxs("div", {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 3,
                      },
                      children: [
                        S.jsx("span", {
                          style: { fontSize: 9, color: Bl },
                          children: "Surface OAR",
                        }),
                        S.jsxs("span", {
                          style: {
                            fontSize: 11,
                            fontWeight: 500,
                            color: f ? "#999" : "#666",
                          },
                          children: [sa.toFixed(1), "%"],
                        }),
                      ],
                    }),
                    S.jsxs("div", {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 3,
                      },
                      children: [
                        S.jsx("span", {
                          style: { fontSize: 9, color: Bl },
                          children: "Effective OAR (through-thickness)",
                        }),
                        S.jsxs("span", {
                          style: { fontSize: 11, fontWeight: 600, color: vt },
                          children: [bu.toFixed(1), "%"],
                        }),
                      ],
                    }),
                    S.jsx("div", {
                      style: {
                        fontSize: 9,
                        color: pu < 0 ? (f ? "#f87171" : "#dc2626") : Bl,
                        textAlign: "center",
                        padding: "2px 0 0",
                        borderTop: `1px solid ${f ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
                      },
                      children:
                        pu < 0
                          ? `${pu.toFixed(1)}%p due to taper`
                          : "No taper loss",
                    }),
                    Ul > 0 &&
                      !Gl &&
                      S.jsxs("div", {
                        style: {
                          fontSize: 9,
                          color: Bl,
                          textAlign: "center",
                          marginTop: 3,
                        },
                        children: ["d_exit = ", Ul.toFixed(2), " mm"],
                      }),
                  ],
                }),
              ut &&
                Gl &&
                S.jsx("div", {
                  style: {
                    margin: "6px 0",
                    padding: "6px 8px",
                    borderRadius: 5,
                    background: f
                      ? "rgba(239,68,68,0.12)"
                      : "rgba(239,68,68,0.08)",
                    border: `1px solid ${f ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`,
                    fontSize: 10,
                    color: he,
                    textAlign: "left",
                    lineHeight: 1.4,
                  },
                  children:
                    "Taper closes the hole at this thickness. Reduce angle or increase diameter.",
                }),
              S.jsx("div", {
                style: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px 12px",
                  marginTop: 8,
                },
                children: [
                  ["Holes", wt.toLocaleString()],
                  ["Hole Area", `${oa.toFixed(2)} mm²`],
                  ["Open Area", `${((sa / 100) * He).toFixed(1)} mm²`],
                  ["Gross Area", `${He.toFixed(0)} mm²`],
                ].map(([_, d]) =>
                  S.jsxs(
                    "div",
                    {
                      style: { textAlign: "left" },
                      children: [
                        S.jsx("div", {
                          style: { fontSize: 9, color: Bl },
                          children: _,
                        }),
                        S.jsx("div", {
                          style: { fontSize: 11, fontWeight: 500 },
                          children: d,
                        }),
                      ],
                    },
                    _,
                  ),
                ),
              }),
              re !== null &&
                S.jsxs("div", {
                  style: {
                    marginTop: 8,
                    padding: "5px 8px",
                    borderRadius: 4,
                    background:
                      re <= 0
                        ? f
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(239,68,68,0.1)"
                        : f
                          ? "rgba(96,165,250,0.1)"
                          : "rgba(37,99,235,0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    S.jsx("span", {
                      style: { fontSize: 9, color: Bl },
                      children: "Min Ligament",
                    }),
                    S.jsxs("span", {
                      style: {
                        fontSize: 11,
                        fontWeight: 500,
                        color: re <= 0 ? he : vt,
                      },
                      children: [re.toFixed(2), " mm"],
                    }),
                  ],
                }),
            ],
          }),
          S.jsxs("div", {
            style: ye,
            children: [
              S.jsx("div", { style: St, children: "Pattern" }),
              S.jsxs("div", {
                style: { marginBottom: 10 },
                children: [
                  S.jsx("div", {
                    style: { fontSize: 10, color: Bl, marginBottom: 4 },
                    children: "Preset (DIN 24041)",
                  }),
                  S.jsx("select", {
                    value: zl,
                    onChange: (_) => ja(parseInt(_.target.value)),
                    style: {
                      width: "100%",
                      height: 28,
                      fontSize: 11,
                      background: Eu,
                      color: da,
                      border: `1px solid ${Wt}`,
                      borderRadius: 4,
                      padding: "0 6px",
                      outline: "none",
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: "pointer",
                    },
                    children: Vr.map((_, d) =>
                      S.jsx("option", { value: d, children: _.name }, d),
                    ),
                  }),
                ],
              }),
              S.jsxs("div", {
                style: { marginBottom: 10 },
                children: [
                  S.jsx("div", {
                    style: { fontSize: 10, color: Bl, marginBottom: 4 },
                    children: "Type",
                  }),
                  S.jsx("div", {
                    style: { display: "flex", flexWrap: "wrap", gap: 4 },
                    children: dy.map((_) =>
                      S.jsx(
                        "button",
                        {
                          onClick: () => {
                            (B(_), r(0));
                          },
                          style: {
                            padding: "4px 8px",
                            fontSize: 10,
                            borderRadius: 4,
                            border: `1px solid ${R === _ ? vt : Wt}`,
                            background:
                              R === _
                                ? f
                                  ? "rgba(96,165,250,0.15)"
                                  : "rgba(37,99,235,0.08)"
                                : "transparent",
                            color: R === _ ? vt : Bl,
                            cursor: "pointer",
                            fontFamily: "'JetBrains Mono', monospace",
                            transition: "all 0.15s",
                          },
                          children: _,
                        },
                        _,
                      ),
                    ),
                  }),
                ],
              }),
              S.jsx(xt, {
                label: "Hole Diameter",
                value: x,
                min: 0.5,
                max: 20,
                step: 0.1,
                onChange: (_) => {
                  const d = U - x,
                    ql = O - x,
                    _s = Hl - x,
                    td = ul - x;
                  (h(_),
                    Z(d + _),
                    p(ql + _),
                    Vl(_s + _),
                    G(td + _),
                    r(0));
                },
                unit: "mm",
                dark: f,
              }),
              R === "Custom Angle" &&
                S.jsx(xt, {
                  label: "Stagger Angle",
                  value: Zl,
                  min: 0,
                  max: 90,
                  step: 1,
                  onChange: Cl,
                  unit: "°",
                  dark: f,
                }),
            ],
          }),
          S.jsxs("div", {
            style: ye,
            children: [
              S.jsx("div", { style: St, children: "Dimensions" }),
              lt
                ? S.jsxs(S.Fragment, {
                    children: [
                      S.jsxs("div", {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                        },
                        children: [
                          S.jsx("span", {
                            style: { fontSize: 10, color: Bl, flex: 1 },
                            children: "Spacing Link",
                          }),
                          S.jsx("button", {
                            onClick: () => {
                              (ol((_) => !_), W || G(Hl));
                            },
                            style: {
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 2,
                              borderRadius: 4,
                              display: "flex",
                              alignItems: "center",
                              opacity: 0.8,
                            },
                            title: W ? "Unlink spacing" : "Link spacing",
                            children: S.jsx(Kr, { linked: W, dark: f }),
                          }),
                        ],
                      }),
                      S.jsx(xt, {
                        label: "Radial Edge Gap",
                        value: Hl - x,
                        min: 0,
                        max: 50,
                        step: 0.5,
                        onChange: gu,
                        unit: "mm",
                        dark: f,
                      }),
                      S.jsx(mn, {
                        label: "ring spacing",
                        value: Hl,
                        dark: f,
                      }),
                      !W &&
                        S.jsxs(S.Fragment, {
                          children: [
                            S.jsx(xt, {
                              label: "Circum. Edge Gap",
                              value: ul - x,
                              min: 0,
                              max: 50,
                              step: 0.5,
                              onChange: Ri,
                              unit: "mm",
                              dark: f,
                            }),
                            S.jsx(mn, {
                              label: "circum. spacing",
                              value: ul,
                              dark: f,
                            }),
                          ],
                        }),
                      W &&
                        S.jsxs("div", {
                          style: {
                            fontSize: 10,
                            color: Bl,
                            marginBottom: 8,
                            padding: "2px 0",
                          },
                          children: [
                            "Circum. Edge Gap: ",
                            (Hl - x).toFixed(1),
                            " mm (linked)",
                          ],
                        }),
                      S.jsx(xt, {
                        label: "Number of Rings",
                        value: it,
                        min: 0,
                        max: 50,
                        step: 1,
                        onChange: Pl,
                        unit: "",
                        dark: f,
                      }),
                      S.jsx("div", {
                        style: {
                          fontSize: 9,
                          color: f ? "#555" : "#aaa",
                          marginBottom: 6,
                        },
                        children: "0 = auto-fill",
                      }),
                      S.jsx(xt, {
                        label: "Holes / Ring",
                        value: Tl,
                        min: 0,
                        max: 100,
                        step: 1,
                        onChange: at,
                        unit: "",
                        dark: f,
                      }),
                      S.jsx("div", {
                        style: {
                          fontSize: 9,
                          color: f ? "#555" : "#aaa",
                          marginBottom: 6,
                        },
                        children: "0 = auto based on spacing",
                      }),
                      S.jsxs("label", {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: Bl,
                          cursor: "pointer",
                          marginTop: 4,
                        },
                        children: [
                          S.jsx("input", {
                            type: "checkbox",
                            checked: el,
                            onChange: (_) => Dl(_.target.checked),
                            style: { accentColor: vt },
                          }),
                          "Center hole",
                        ],
                      }),
                    ],
                  })
                : ht
                  ? S.jsxs(S.Fragment, {
                      children: [
                        S.jsxs("div", {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 4,
                          },
                          children: [
                            S.jsx("span", {
                              style: { fontSize: 10, color: Bl, flex: 1 },
                              children: "Edge Gap Link (X = Y)",
                            }),
                            S.jsx("button", {
                              onClick: () => {
                                (j((_) => !_), q || p(U));
                              },
                              style: {
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 2,
                                borderRadius: 4,
                                display: "flex",
                                alignItems: "center",
                                opacity: 0.8,
                              },
                              title: q ? "Unlink edge gap" : "Link edge gap",
                              children: S.jsx(Kr, { linked: q, dark: f }),
                            }),
                          ],
                        }),
                        S.jsx(xt, {
                          label: q ? "Edge Gap (X = Y)" : "X Edge Gap",
                          value: U - x,
                          min: 0,
                          max: 50,
                          step: 0.1,
                          onChange: Ua,
                          unit: "mm",
                          dark: f,
                        }),
                        S.jsx(mn, {
                          label: q ? "pitch" : "X pitch",
                          value: U,
                          dark: f,
                        }),
                        !q &&
                          S.jsxs(S.Fragment, {
                            children: [
                              S.jsx(xt, {
                                label: "Y Edge Gap",
                                value: O - x,
                                min: 0,
                                max: 50,
                                step: 0.1,
                                onChange: mu,
                                unit: "mm",
                                dark: f,
                              }),
                              S.jsx(mn, {
                                label: "Y pitch",
                                value: O,
                                dark: f,
                              }),
                            ],
                          }),
                      ],
                    })
                  : S.jsxs(S.Fragment, {
                      children: [
                        S.jsx(xt, {
                          label: "X Edge Gap",
                          value: U - x,
                          min: 0,
                          max: 50,
                          step: 0.1,
                          onChange: Ua,
                          unit: "mm",
                          dark: f,
                        }),
                        S.jsx(mn, {
                          label: "X pitch",
                          value: U,
                          dark: f,
                        }),
                        S.jsxs("div", {
                          style: {
                            fontSize: 10,
                            color: Bl,
                            marginBottom: 8,
                            padding: "2px 0",
                          },
                          children: [
                            "Y Edge Gap: ",
                            (
                              (R === "Staggered 60°"
                                ? (U * Math.sqrt(3)) / 2
                                : U) - x
                            ).toFixed(2),
                            " mm (auto)",
                            S.jsxs("span", {
                              style: {
                                marginLeft: 6,
                                fontSize: 9,
                                color: f ? "#555" : "#aaa",
                              },
                              children: [
                                "pitch ",
                                (R === "Staggered 60°"
                                  ? (U * Math.sqrt(3)) / 2
                                  : U
                                ).toFixed(2),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
              S.jsx(xt, {
                label: "Sheet Width",
                value: Y,
                min: 10,
                max: 1e3,
                step: 1,
                onChange: pl,
                unit: "mm",
                dark: f,
              }),
              S.jsx(xt, {
                label: "Sheet Height",
                value: V,
                min: 10,
                max: 1e3,
                step: 1,
                onChange: fl,
                unit: "mm",
                dark: f,
              }),
              S.jsx(xt, {
                label: "Margin",
                value: H,
                min: 0,
                max: 50,
                step: 0.5,
                onChange: Ol,
                unit: "mm",
                dark: f,
              }),
            ],
          }),
          S.jsxs("div", {
            style: ye,
            children: [
              S.jsx("div", {
                style: St,
                children: "Sheet Thickness & Hole Taper",
              }),
              S.jsx(xt, {
                label: "Thickness (t)",
                value: A,
                min: 0,
                max: 10,
                step: 0.1,
                onChange: C,
                unit: "mm",
                dark: f,
              }),
              S.jsx(xt, {
                label: "Taper Angle (θ)",
                value: N,
                min: 0,
                max: 15,
                step: 0.1,
                onChange: F,
                unit: "°",
                dark: f,
              }),
              ut &&
                S.jsxs(S.Fragment, {
                  children: [
                    S.jsxs("div", {
                      style: { marginTop: 2 },
                      children: [
                        S.jsx("div", {
                          style: { fontSize: 10, color: Bl, marginBottom: 6 },
                          children: "Taper Direction",
                        }),
                        S.jsx("div", {
                          style: { display: "flex", gap: 4 },
                          children: ["Top larger", "Bottom larger"].map((_) =>
                            S.jsx(
                              Ne,
                              {
                                label: _,
                                active: ll === _,
                                onClick: () => yl(_),
                              },
                              _,
                            ),
                          ),
                        }),
                      ],
                    }),
                    S.jsxs("div", {
                      style: {
                        marginTop: 8,
                        padding: "5px 8px",
                        borderRadius: 4,
                        background: Gl
                          ? f
                            ? "rgba(239,68,68,0.12)"
                            : "rgba(239,68,68,0.08)"
                          : f
                            ? "rgba(96,165,250,0.08)"
                            : "rgba(37,99,235,0.06)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      },
                      children: [
                        S.jsx("span", {
                          style: { fontSize: 9, color: Bl },
                          children: "Exit Diameter",
                        }),
                        S.jsx("span", {
                          style: {
                            fontSize: 11,
                            fontWeight: 500,
                            color: Gl ? he : vt,
                          },
                          children: Gl ? "0 (closed)" : `${Ul.toFixed(2)} mm`,
                        }),
                      ],
                    }),
                  ],
                }),
              !ut &&
                S.jsx("div", {
                  style: {
                    fontSize: 9,
                    color: f ? "#444" : "#bbb",
                    marginTop: 6,
                    lineHeight: 1.4,
                  },
                  children:
                    "Set thickness and angle above 0 to enable taper compensation.",
                }),
            ],
          }),
          S.jsxs("div", {
            style: { ...ye, borderBottom: "none", paddingBottom: 20 },
            children: [
              S.jsx("div", { style: St, children: "Export" }),
              S.jsx("div", {
                style: { display: "flex", gap: 6 },
                children: [
                  ["SVG", bn],
                  ["PNG 2x", Tu],
                ].map(([_, d]) =>
                  S.jsxs(
                    "button",
                    {
                      onClick: d,
                      style: {
                        flex: 1,
                        padding: "7px 0",
                        fontSize: 11,
                        fontWeight: 500,
                        background: Ha,
                        color: da,
                        border: "none",
                        borderRadius: 5,
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                        transition: "background 0.15s",
                      },
                      onMouseEnter: (ql) =>
                        (ql.currentTarget.style.background = f
                          ? "#333338"
                          : "#d4d4da"),
                      onMouseLeave: (ql) =>
                        (ql.currentTarget.style.background = Ha),
                      children: ["↓ ", _],
                    },
                    _,
                  ),
                ),
              }),
            ],
          }),
        ],
      }),
      S.jsx("style", {
        children: `
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${vt}; cursor: pointer; border: 2px solid ${f ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: ${vt}; cursor: pointer; border: 2px solid ${f ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        select option { background: ${f ? "#1e1e22" : "#fff"}; color: ${da}; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${f ? "#333" : "#ccc"}; border-radius: 3px; }
        * { box-sizing: border-box; }
      `,
      }),
    ],
  });
}
ry.createRoot(document.getElementById("root")).render(S.jsx(py, {}));
