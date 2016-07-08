'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Pool = exports.KaplanSniperAgent = exports.UnitAgent = exports.ZIAgent = exports.Agent = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var async = _interopRequireWildcard(_async);

var _clone = require('clone');

var _clone2 = _interopRequireDefault(_clone);

var _events = require('events');

var _prob = require('prob.js');

var ProbJS = _interopRequireWildcard(_prob);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var privateNextId = 1;
function nextId() {
    return privateNextId++;
}

function sum(a) {
    var i = void 0,
        l = void 0,
        total = 0;
    for (i = 0, l = a.length; i < l; ++i) {
        total += a[i];
    }return total;
}

function dot(a, b) {
    var i = void 0,
        l = void 0,
        total = 0;

    /* istanbul ignore next */

    if (a.length !== b.length) throw new Error("market-agents: vector dimensions do not match in dot(a,b)");
    for (i = 0, l = a.length; i < l; ++i) {
        if (b[i]) total += a[i] * b[i];
    }return total;
}

function poissonWake() {
    var delta = ProbJS.exponential(this.rate)();
    var result = this.wakeTime + delta;
    if (result > 0) return result;
}

var Agent = exports.Agent = function (_EventEmitter) {
    _inherits(Agent, _EventEmitter);

    function Agent(options) {
        _classCallCheck(this, Agent);

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Agent).call(this));

        var defaults = {
            id: nextId(),
            description: 'blank agent',
            inventory: {},
            money: 'money',
            values: {},
            costs: {},
            wakeTime: 0,
            rate: 1,
            period: {
                number: 0,
                duration: 1000,
                equalDuration: true
            },
            nextWake: poissonWake
        };
        Object.assign(_this, defaults, (0, _clone2.default)(options, false));
        _this.init();
        return _this;
    }

    _createClass(Agent, [{
        key: 'init',
        value: function init(newSettings) {
            if ((typeof newSettings === 'undefined' ? 'undefined' : _typeof(newSettings)) === 'object') {
                // work with a shallow copy of the newSettings so
                // the code can delete the inventory setting without side effects
                var mySettings = Object.assign({}, newSettings);
                // copy new values to inventory.  do not reset other inventory values
                Object.assign(this.inventory, mySettings.inventory);
                // reset non-inventory as specified, completely overwriting previous
                // to execute this reset, first: delete the inventory settings, then apply the remainder
                delete mySettings.inventory;
                Object.assign(this, mySettings);
            }
            // if this.money is defined but is not in inventory, zero the inventory of this.money
            if (this.money && !this.inventory[this.money]) this.inventory[this.money] = 0;
            this.wakeTime = this.nextWake();
        }
    }, {
        key: 'initPeriod',
        value: function initPeriod(period) {
            // period might look like this
            // period = {number:5, startTime:50000, init: {inventory:{X:0, Y:0}, values:{X:[300,200,100,0,0,0,0]}}}
            // or period could be simply a number
            if ((typeof period === 'undefined' ? 'undefined' : _typeof(period)) === 'object') this.period = (0, _clone2.default)(period, false);else if (typeof period === 'number') this.period.number = period;
            if (this.period.equalDuration && this.period.duration) {
                this.period.startTime = this.period.number * this.period.duration;
                this.period.endTime = (1 + this.period.number) * this.period.duration;
            }
            if (typeof this.period.startTime === 'number') this.wakeTime = this.period.startTime;
            this.init(this.period.init);
            this.emit('pre-period');
        }
    }, {
        key: 'endPeriod',
        value: function endPeriod() {
            if (typeof this.produce === 'function') this.produce();
            if (typeof this.redeem === 'function') this.redeem();
            this.emit('post-period');
        }
    }, {
        key: 'pctPeriod',
        value: function pctPeriod() {
            if (this.period.startTime !== undefined && this.period.endTime > 0 && this.wakeTime !== undefined) {
                return (this.wakeTime - this.period.startTime) / (this.period.endTime - this.period.startTime);
            }
        }
    }, {
        key: 'poissonWakesRemainingInPeriod',
        value: function poissonWakesRemainingInPeriod() {
            if (this.rate > 0 && this.wakeTime !== undefined && this.period.endTime > 0) {
                return (this.period.endTime - this.wakeTime) * this.rate;
            }
        }
    }, {
        key: 'wake',
        value: function wake(info) {
            this.emit('wake', info);
            var nextTime = this.nextWake();
            if (this.period.endTime) {
                if (nextTime < this.period.endTime) this.wakeTime = nextTime;else this.wakeTime = undefined;
            } else {
                this.wakeTime = nextTime;
            }
        }
    }, {
        key: 'transfer',
        value: function transfer(myTransfers, memo) {
            if (myTransfers) {
                this.emit('pre-transfer', myTransfers, memo);
                var goods = Object.keys(myTransfers);
                for (var i = 0, l = goods.length; i < l; ++i) {
                    if (this.inventory[goods[i]]) this.inventory[goods[i]] += myTransfers[goods[i]];else this.inventory[goods[i]] = myTransfers[goods[i]];
                }
                this.emit('post-transfer', myTransfers, memo);
            }
        }
    }, {
        key: 'unitCostFunction',
        value: function unitCostFunction(good, hypotheticalInventory) {
            var costs = this.costs[good];
            if (Array.isArray(costs) && hypotheticalInventory[good] <= 0) {
                return costs[-hypotheticalInventory[good]];
            }
        }
    }, {
        key: 'unitValueFunction',
        value: function unitValueFunction(good, hypotheticalInventory) {
            var vals = this.values[good];
            if (Array.isArray(vals) && hypotheticalInventory[good] >= 0) {
                return vals[hypotheticalInventory[good]];
            }
        }
    }, {
        key: 'redeem',
        value: function redeem() {
            if (this.values) {
                var trans = {};
                var goods = Object.keys(this.values);
                trans[this.money] = 0;
                for (var i = 0, l = goods.length; i < l; ++i) {
                    var g = goods[i];
                    if (this.inventory[g] > 0) {
                        trans[g] = -this.inventory[g];
                        trans[this.money] += sum(this.values[g].slice(0, this.inventory[g]));
                    }
                }
                this.emit('pre-redeem', trans);
                this.transfer(trans, { isRedeem: 1 });
                this.emit('post-redeem', trans);
            }
        }
    }, {
        key: 'produce',
        value: function produce() {
            if (this.costs) {
                var trans = {};
                var goods = Object.keys(this.costs);
                trans[this.money] = 0;
                for (var i = 0, l = goods.length; i < l; ++i) {
                    var g = goods[i];
                    if (this.inventory[g] < 0) {
                        trans[this.money] -= sum(this.costs[g].slice(0, -this.inventory[g]));
                        trans[g] = -this.inventory[g];
                    }
                }
                this.emit('pre-produce', trans);
                this.transfer(trans, { isProduce: 1 });
                this.emit('post-produce', trans);
            }
        }
    }]);

    return Agent;
}(_events.EventEmitter);

var ZIAgent = exports.ZIAgent = function (_Agent) {
    _inherits(ZIAgent, _Agent);

    // from an idea developed by Gode and Sunder in a series of economics papers

    function ZIAgent(options) {
        _classCallCheck(this, ZIAgent);

        var defaults = {
            description: 'Gode and Sunder style ZI Agent',
            markets: [],
            minPrice: 0,
            maxPrice: 1000
        };

        var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(ZIAgent).call(this, Object.assign({}, defaults, options)));

        _this2.on('wake', _this2.sendBidsAndAsks);
        return _this2;
    }

    _createClass(ZIAgent, [{
        key: 'sendBidsAndAsks',
        value: function sendBidsAndAsks() {
            for (var i = 0, l = this.markets.length; i < l; ++i) {
                var market = this.markets[i];
                var unitValue = this.unitValueFunction(market.goods, this.inventory);
                if (unitValue > 0) {
                    if (this.ignoreBudgetConstraint) unitValue = this.maxPrice;
                    var myPrice = this.bidPrice(unitValue, market); // calculate my buy price proposal
                    if (myPrice) this.bid(market, myPrice); // send my price proposal
                }
                var unitCost = this.unitCostFunction(market.goods, this.inventory);
                if (unitCost > 0) {
                    if (this.ignoreBudgetConstraint) unitCost = this.minPrice;
                    var _myPrice = this.askPrice(unitCost, market); // calculate my sell price proposal
                    if (_myPrice) this.ask(market, _myPrice); // send my price proposal
                }
            }
        }
    }, {
        key: 'bidPrice',
        value: function bidPrice(marginalValue) {
            if (typeof marginalValue !== 'number') return undefined;
            var p = void 0;
            if (marginalValue === this.minPrice) return marginalValue;
            if (marginalValue < this.minPrice) return undefined;
            if (this.integer) {

                /* because Floor rounds down, add 1 to value to be in the range of possible prices */
                /* guard against rare edge case with do/while */

                do {
                    p = Math.floor(ProbJS.uniform(this.minPrice, marginalValue + 1)());
                } while (p > marginalValue);
            } else {
                p = ProbJS.uniform(this.minPrice, marginalValue)();
            }
            return p;
        }
    }, {
        key: 'askPrice',
        value: function askPrice(marginalCost) {
            if (typeof marginalCost !== 'number') return undefined;
            var p = void 0;
            if (marginalCost === this.maxPrice) return marginalCost;
            if (marginalCost > this.maxPrice) return undefined;
            if (this.integer) {

                /* because Floor rounds down, add 1 to value to be in the range of possible prices */
                /* guard against rare edge case with do/while */

                do {
                    p = Math.floor(ProbJS.uniform(marginalCost, this.maxPrice + 1)());
                } while (p > this.maxPrice);
            } else {
                p = ProbJS.uniform(marginalCost, this.maxPrice)();
            }
            return p;
        }
    }]);

    return ZIAgent;
}(Agent);

var um1p2 = ProbJS.uniform(-1, 2);
var um1p1 = ProbJS.uniform(-1, 1);

var UnitAgent = exports.UnitAgent = function (_ZIAgent) {
    _inherits(UnitAgent, _ZIAgent);

    function UnitAgent(options) {
        _classCallCheck(this, UnitAgent);

        var defaults = {
            description: "Paul Brewer's HBEER UNIT agent that bids/asks within 1 price unit of previous price"
        };
        return _possibleConstructorReturn(this, Object.getPrototypeOf(UnitAgent).call(this, Object.assign({}, defaults, options)));
    }

    _createClass(UnitAgent, [{
        key: 'randomDelta',
        value: function randomDelta() {
            var delta = void 0;
            if (this.integer) {
                do {
                    delta = Math.floor(um1p2());
                } while (delta <= -2 || delta >= 2.0);
            } else {
                do {
                    delta = um1p1();
                } while (delta < -1 || delta > 1);
            }
            return delta;
        }
    }, {
        key: 'bidPrice',
        value: function bidPrice(marginalValue, market) {
            var p = void 0;
            if (typeof marginalValue !== 'number') return undefined;
            var previous = market.lastTradePrice();
            if (previous) p = previous + this.randomDelta();else p = _get(Object.getPrototypeOf(UnitAgent.prototype), 'bidPrice', this).call(this, marginalValue);
            if (p > marginalValue || p > this.maxPrice || p < this.minPrice) return undefined;
            return p && this.integer ? Math.floor(p) : p;
        }
    }, {
        key: 'askPrice',
        value: function askPrice(marginalCost, market) {
            if (typeof marginalCost !== 'number') return undefined;
            var p = void 0;
            var previous = market.lastTradePrice();
            if (previous) p = previous + this.randomDelta();else p = _get(Object.getPrototypeOf(UnitAgent.prototype), 'askPrice', this).call(this, marginalCost);
            if (p < marginalCost || p > this.maxPrice || p < this.minPrice) return undefined;
            return p && this.integer ? Math.floor(p) : p;
        }
    }]);

    return UnitAgent;
}(ZIAgent);

/* see e.g. "High Performance Bidding Agents for the Continuous Double Auction" 
 *                Gerald Tesauro and Rajarshi Das, Institute for Advanced Commerce, IBM 
 *
 *  http://researcher.watson.ibm.com/researcher/files/us-kephart/dblauc.pdf
 *
 *      for discussion of Kaplan's Sniper traders on pp. 4-5
*/

var KaplanSniperAgent = exports.KaplanSniperAgent = function (_ZIAgent2) {
    _inherits(KaplanSniperAgent, _ZIAgent2);

    function KaplanSniperAgent(options) {
        _classCallCheck(this, KaplanSniperAgent);

        var defaults = {
            description: "Kaplan's snipers, trade on 'juicy' price, or low spread, or end of period",
            desiredSpread: 10
        };
        return _possibleConstructorReturn(this, Object.getPrototypeOf(KaplanSniperAgent).call(this, Object.assign({}, defaults, options)));
    }

    _createClass(KaplanSniperAgent, [{
        key: 'bidPrice',
        value: function bidPrice(marginalValue, market) {
            if (typeof marginalValue !== 'number') return undefined;
            var currentBid = market.currentBidPrice();
            var currentAsk = market.currentAskPrice();

            // a trade can only occur if currentAsk <= marginalValue
            if (currentAsk <= marginalValue) {

                // snipe if ask price is less than or equal to juicy ask price
                var juicyPrice = this.getJuicyAskPrice();
                if (juicyPrice > 0 && currentAsk <= juicyPrice) return currentAsk;

                // snipe if low bid ask spread
                if (currentAsk > 0 && currentBid > 0 && currentAsk - currentBid <= this.desiredSpread) return currentAsk;

                // snipe if period end is three wakes away or less
                if (this.poissonWakesRemainingInPeriod() <= 3) return currentAsk;
            }
            // otherwise return undefined
        }
    }, {
        key: 'askPrice',
        value: function askPrice(marginalCost, market) {
            if (typeof marginalCost !== 'number') return undefined;
            var currentBid = market.currentBidPrice();
            var currentAsk = market.currentAskPrice();
            // only trade if currentBid >= marginalCost
            if (currentBid >= marginalCost) {

                // snipe if bid price is greater than or equal to juicy bid price
                var juicyPrice = this.getJuicyBidPrice();
                if (juicyPrice > 0 && currentBid >= juicyPrice) return currentBid;

                // snipe if low bid ask spread
                if (currentAsk > 0 && currentBid > 0 && currentAsk - currentBid <= this.desiredSpread) return currentBid;

                // snipe if period end is three wakes away or less
                if (this.poissonWakesRemainingInPeriod() <= 3) return currentBid;
            }
            // otherwise return undefined
        }
    }]);

    return KaplanSniperAgent;
}(ZIAgent);

var Pool = exports.Pool = function () {
    function Pool() {
        _classCallCheck(this, Pool);

        this.agents = [];
        this.agentsById = {};
    }

    _createClass(Pool, [{
        key: 'push',
        value: function push(agent) {
            if (!(agent instanceof Agent)) throw new Error("Pool.push(agent), agent is not an instance of Agent or descendents");
            if (!this.agentsById[agent.id]) {
                this.agents.push(agent);
                this.agentsById[agent.id] = agent;
            }
        }
    }, {
        key: 'next',
        value: function next() {
            if (this.nextCache) return this.nextCache;
            var tMin = 1e20,
                i = 0,
                l = this.agents.length,
                A = this.agents,
                t = 0,
                result = 0;
            for (; i < l; i++) {
                t = A[i].wakeTime;
                if (t > 0 && t < tMin) {
                    result = A[i];
                    tMin = t;
                }
            }
            this.nextCache = result;
            return result;
        }
    }, {
        key: 'wake',
        value: function wake() {
            var A = this.next();
            if (A) {
                A.wake();
                // wipe nextCache
                delete this.nextCache;
            }
        }
    }, {
        key: 'endTime',
        value: function endTime() {
            var endTime = 0;
            for (var i = 0, l = this.agents.length; i < l; ++i) {
                var a = this.agents[i];
                if (a.period.endTime > endTime) endTime = a.period.endTime;
            }
            if (endTime > 0) return endTime;
        }
    }, {
        key: 'run',
        value: function run(untilTime, done, batch) {
            // note: setTimeout slows this down significnatly if setImmediate is not available
            var that = this;
            if (typeof done !== 'function') throw new Error("Pool.run: done callback function undefined");
            async.whilst(function () {
                var nextAgent = that.next();
                return nextAgent && nextAgent.wakeTime < untilTime;
            }, function (cb) {
                async.setImmediate(function () {
                    that.syncRun(untilTime, batch || 1);
                    cb();
                });
            }, function (e) {
                done.call(that, e);
            });
        }
    }, {
        key: 'syncRun',
        value: function syncRun(untilTime, limitCalls) {
            var nextAgent = this.next();
            var calls = 0;
            while (nextAgent && nextAgent.wakeTime < untilTime && !(calls >= limitCalls)) {
                this.wake();
                nextAgent = this.next();
                calls++;
            }
        }
    }, {
        key: 'initPeriod',
        value: function initPeriod(param) {
            // passing param to all the agents is safe because Agent.initPeriod does a deep clone
            if (Array.isArray(param) && param.length > 0) {
                for (var i = 0, l = this.agents.length; i < l; i++) {
                    this.agents[i].initPeriod(param[i % param.length]);
                }
            } else {
                for (var _i = 0, _l = this.agents.length; _i < _l; _i++) {
                    this.agents[_i].initPeriod(param);
                }
            }
        }
    }, {
        key: 'endPeriod',
        value: function endPeriod() {
            for (var i = 0, l = this.agents.length; i < l; i++) {
                this.agents[i].endPeriod();
            }
        }
    }, {
        key: 'trade',
        value: function trade(tradeSpec) {
            var i = void 0,
                l = void 0,
                buyerTransfer = void 0,
                sellerTransfer = void 0;
            if ((typeof tradeSpec === 'undefined' ? 'undefined' : _typeof(tradeSpec)) !== 'object') return;
            if (tradeSpec.bs && tradeSpec.goods && tradeSpec.money && Array.isArray(tradeSpec.prices) && Array.isArray(tradeSpec.buyQ) && Array.isArray(tradeSpec.sellQ) && Array.isArray(tradeSpec.buyId) && Array.isArray(tradeSpec.sellId)) {
                if (tradeSpec.bs === 'b') {
                    if (tradeSpec.buyId.length !== 1) throw new Error("Pool.trade expected tradeSpec.buyId.length===1, got:" + tradeSpec.buyId.length);
                    if (tradeSpec.buyQ[0] !== sum(tradeSpec.sellQ)) throw new Error("Pool.trade invalid buy -- tradeSpec buyQ[0] != sum(sellQ)");
                    buyerTransfer = {};
                    buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[0];
                    buyerTransfer[tradeSpec.money] = -dot(tradeSpec.sellQ, tradeSpec.prices);
                    this.agentsById[tradeSpec.buyId[0]].transfer(buyerTransfer, { isTrade: 1, isBuy: 1 });
                    for (i = 0, l = tradeSpec.prices.length; i < l; ++i) {
                        sellerTransfer = {};
                        sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[i];
                        sellerTransfer[tradeSpec.money] = tradeSpec.prices[i] * tradeSpec.sellQ[i];
                        this.agentsById[tradeSpec.sellId[i]].transfer(sellerTransfer, { isTrade: 1, isSellAccepted: 1 });
                    }
                } else if (tradeSpec.bs === 's') {
                    if (tradeSpec.sellId.length !== 1) throw new Error("Pool.trade expected tradeSpec.sellId.length===1. got:" + tradeSpec.sellId.length);
                    if (tradeSpec.sellQ[0] !== sum(tradeSpec.buyQ)) throw new Error("Pool.trade invalid sell -- tradeSpec sellQ[0] != sum(buyQ)");
                    sellerTransfer = {};
                    sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[0];
                    sellerTransfer[tradeSpec.money] = dot(tradeSpec.buyQ, tradeSpec.prices);
                    this.agentsById[tradeSpec.sellId[0]].transfer(sellerTransfer, { isTrade: 1, isSell: 1 });
                    for (i = 0, l = tradeSpec.prices.length; i < l; ++i) {
                        buyerTransfer = {};
                        buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[i];
                        buyerTransfer[tradeSpec.money] = -tradeSpec.prices[i] * tradeSpec.buyQ[i];
                        this.agentsById[tradeSpec.buyId[i]].transfer(buyerTransfer, { isTrade: 1, isBuyAccepted: 1 });
                    }
                }
            }
        }
    }, {
        key: 'distribute',
        value: function distribute(field, good, aggregateArray) {
            var i = void 0,
                l = void 0;
            var myCopy = void 0;
            if (Array.isArray(aggregateArray)) {
                myCopy = aggregateArray.slice();
            } else if (typeof aggregateArray === 'string') {
                myCopy = aggregateArray.replace(/,/g, " ").split(/\s+/).map(function (s) {
                    return +s;
                }).filter(function (v) {
                    return v > 0;
                });
            } else {

                /* istanbul ignore next */

                throw new Error("Error: Pool.prototype.distribute: expected aggregate to be Array or String, got: " + (typeof aggregateArray === 'undefined' ? 'undefined' : _typeof(aggregateArray)));
            }
            if (field !== 'values' && field !== 'costs') throw new Error("Pool.distribute(field,good,aggArray) field should be 'values' or 'costs', got:" + field);
            for (i = 0, l = this.agents.length; i < l; ++i) {
                if (typeof this.agents[i][field] === 'undefined') this.agents[i][field] = {};
                this.agents[i][field][good] = [];
            }
            i = 0;
            l = this.agents.length;
            while (myCopy.length > 0) {
                this.agents[i][field][good].push(myCopy.shift());
                i = (i + 1) % l;
            }
        }
    }]);

    return Pool;
}();