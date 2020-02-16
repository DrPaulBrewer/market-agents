import clone from 'clone';
import { EventEmitter } from 'events';
import * as ProbJS from 'prob.js';

let privateNextId = 1;

function nextId() { return privateNextId++; }

function sum(a) {
  let i, l, total = 0;
  for (i = 0, l = a.length;i<l;++i)
    total += +a[i];
  return total;
}

/* ignore this function in test coverage stats */
/* istanbul ignore next */
function dot(a, b) {
  let i, l, total = 0;
  if (a.length !== b.length)
    throw new Error("market-agents: vector dimensions do not match in dot(a,b)");
  for (i = 0, l = a.length;i < l;++i)
    if (a[i] && b[i])
      total += (a[i] * b[i]);
  return total;
}


function poissonWake() {
  const delta = ProbJS.exponential(this.rate)();
  // undefined is a valid this.wakeTime
  const result = this.wakeTime + delta;
  // block NaN and negative values
  if (result > 0)
    return result;
}

/**
 * Agent with Poisson-distributed opportunities to act, with period managment,  optional inventory, unit values and costs, and end-of-period production and consumption to satisfy trades
 *
 */

export class Agent extends EventEmitter {

  /**
   * creates an Agent with clone of specified options and initializes with .init().
   *   Option properties are stored directly on the created agent's this.
   *
   * @param {Object} options Agent creation options
   * @param {string} [options.description] text description of agent, optional
   * @param {Object} [options.inventory={}] initial inventory, as object with good names as keys and levels as values
   * @param {string} [options.money='money'] Good used as money by this agent
   * @param {Object} [options.values={}] marginal value table of agent for goods that are redeemed at end-of-period, as object with goods as keys and numeric arrays as values
   * @param {Object} [options.costs={}] marginal cost table of agent for goods that are produced at end-of-period, as object with goods as keys and numeric arrays as values
   * @param {number} [options.wakeTime=0] initial wake-up time for agent, adjusted by this.init() to first poisson-based wake with .nextWake()
   * @param {number} [options.rate=1] Poisson-arrival rate of agent wake events
   * @param {function():number} [options.nextWake=poissonWake] calculates next Agent wake-up time
   *
   */

  constructor(options) {
    super();
    const defaults = {
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
    Object.assign(this, defaults, clone(options, false));
    this.init();
  }

  /**
   * initialize an agent to new settings
   * @param {Object} [newSettings] see constructor
   *
   */

  init(newSettings) {
    if (typeof(newSettings) === 'object') {
      // work with a shallow copy of the newSettings so
      // the code can delete the inventory setting without side effects
      let mySettings = Object.assign({}, newSettings);
      // copy new values to inventory.  do not reset other inventory values
      Object.assign(this.inventory, mySettings.inventory);
      // reset non-inventory as specified, completely overwriting previous
      // to execute this reset, first: delete the inventory settings, then apply the remainder
      delete mySettings.inventory;
      Object.assign(this, mySettings);
    }
    // if this.money is defined but is not in inventory, zero the inventory of this.money
    if (this.money && !(this.inventory[this.money]))
      this.inventory[this.money] = 0;

    /**
     * time, in JS ms since epoch, of agent wake
     * @type {number} this.wakeTime
     */

    this.wakeTime = this.nextWake();
  }

  /**
   * re-initialize agent to the beginning of a new simulation period
   *
   * @param {number|Object} period A period initialization object, or a number indicating a new period using the previous period's initialization object
   * @param {number} period.number A number, usually sequential, identifying the next period, e.g. 1,2,3,4,5,...
   * @param {boolean} [period.equalDuration=false] with positive period.duration, autogenerates startTime and endTime as n or n+1 times period.duration
   * @param {number} [period.duration] the length of the period, used with period.equalDuration
   * @param {number} [period.startTime] period begins, manual setting for initial time value for agent wakeTime
   * @param {number} [period.endTime] period ends, no agent wake events will be emitted for this period after this time
   * @param {Object} [period.init] initializer for other agent properties, passed to .init()
   * @emits {pre-period} when initialization to new period is complete
   * @example
   * myAgent.initPeriod({number:1, duration:1000, equalDuration: true});
   * myAgent.initPeriod(2);
   */

  initPeriod(period) {
    // period might look like this
    // period = {number:5, startTime:50000, init: {inventory:{X:0, Y:0}, values:{X:[300,200,100,0,0,0,0]}}}
    // or period could be simply a number
    if (typeof(period) === 'object')
      this.period = clone(period, false);
    else if (typeof(period) === 'number')
      this.period.number = period;
    if (this.period.equalDuration && this.period.duration) {
      this.period.startTime = this.period.number * this.period.duration;
      this.period.endTime = (1 + this.period.number) * this.period.duration;
    }
    if (typeof(this.period.startTime) === 'number')
      this.wakeTime = this.period.startTime;
    this.init(this.period.init);
    this.emit('pre-period');
  }

  /**
   * ends current period, causing agent to undertake end-of-period tasks such as production and redemption of units
   *
   * @emits {post-period} when period ends, always, but after first completing any production/redemption
   */

  endPeriod() {
    if (typeof(this.produce) === 'function') this.produce();
    if (typeof(this.redeem) === 'function') this.redeem();
    this.emit('post-period');
  }

  /**
   * percent of period used
   *
   * @return {number} proportion of period time used as a number from 0.0, at beginning of period, to 1.0 at end of period.
   *
   */


  pctPeriod() {
    if ((this.period.startTime !== undefined) && (this.period.endTime > 0) && (this.wakeTime !== undefined)) {
      return (this.wakeTime - this.period.startTime) / (this.period.endTime - this.period.startTime);
    }
  }

  /**
   * guess at number of random Poisson wakes remaining in period
   *
   * @return {number} "expected" number of remaining random Poisson wakes, calculated as (this.period.endTime-this.wakeTime)*rate
   *
   */

  poissonWakesRemainingInPeriod() {
    if ((this.rate > 0) && (this.wakeTime !== undefined) && (this.period.endTime > 0)) {
      return (this.period.endTime - this.wakeTime) * this.rate;
    }
  }

  /**
   * wakes agent so it can act, emitting wake, and sets next wakeTime from this.nextWake() unless period.endTime exceeded
   *
   * @param {Object} [info] optional info passed to this.emit('wake', info)
   * @emits {wake(info)} immediately
   */

  wake(info) {
    this.emit('wake', info);
    const nextTime = this.nextWake();
    if (this.period.endTime) {
      if (nextTime < this.period.endTime)
        this.wakeTime = nextTime;
      else
        this.wakeTime = undefined;
    } else {
      this.wakeTime = nextTime;
    }
  }

  /**
   * increases or decreases agent's inventories of one or more goods and/or money
   *
   * @param {Object} myTransfers object with goods as keys and changes in inventory as number values
   * @param {Object} [memo] optional memo passed to event listeners
   * @emits {pre-transfer(myTransfers, memo)} before transfer takes place, modifications to myTransfers will change transfer
   * @emits {post-transfer(myTransfers, memo)} after transfer takes place
   */

  transfer(myTransfers, memo) {
    if (myTransfers) {
      this.emit('pre-transfer', myTransfers, memo);
      const goods = Object.keys(myTransfers);
      for (let i = 0, l = goods.length;i < l;++i) {
        if (this.inventory[goods[i]])
          this.inventory[goods[i]] += myTransfers[goods[i]];
        else
          this.inventory[goods[i]] = myTransfers[goods[i]];
      }
      this.emit('post-transfer', myTransfers, memo);
    }
  }

  /**
   * agent's marginal cost of producing next unit
   *
   * @param {String} good (e.g. "X", "Y")
   * @param {Object} hypotheticalInventory object with goods as keys and values as numeric levels of inventory
   * @return {number} marginal unit cost of next unit, at given (negative) hypothetical inventory, using agent's configured costs
   */

  unitCostFunction(good, hypotheticalInventory) {
    const costs = this.costs[good];
    if ((Array.isArray(costs)) && (hypotheticalInventory[good] <= 0)) {
      return costs[-hypotheticalInventory[good]];
    }
  }

  /**
   * agent's marginal value for redeeming next unit
   *
   * @param {String} good (e.g. "X", "Y")
   * @param {Object} hypotheticalInventory object with goods as keys and values as numeric levels of inventory
   * @return {number} marginal unit value of next unit, at given (positive) hypothetical inventory, using agent's configured values
   */

  unitValueFunction(good, hypotheticalInventory) {
    const vals = this.values[good];
    if ((Array.isArray(vals)) && (hypotheticalInventory[good] >= 0)) {
      return vals[hypotheticalInventory[good]];
    }
  }

  /**
   * redeems units in positive inventory with configured values, usually called automatically at end-of-period.
   * transfer uses memo object {isRedeem:1}
   *
   * @emits {pre-redeem(transferAmounts)} before calling .transfer, can modify transferAmounts
   * @emits {post-redeem(transferAmounts)} after calling .transfer
   */

  redeem() {
    if (this.values) {
      const trans = {};
      const goods = Object.keys(this.values);
      trans[this.money] = 0;
      for (let i = 0, l = goods.length;i < l;++i) {
        let g = goods[i];
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

  /**
   * produces units in negative inventory with configured costs, usually called automatically at end-of-period.
   * transfer uses memo object {isProduce:1}
   *
   * @emits {pre-redeem(transferAmounts)} before calling .transfer, can modify transferAmounts
   * @emits {post-redeem(transferAmounts)} after calling .transfer
   */

  produce() {
    if (this.costs) {
      const trans = {};
      const goods = Object.keys(this.costs);
      trans[this.money] = 0;
      for (let i = 0, l = goods.length;i < l;++i) {
        let g = goods[i];
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
}

/**
 * agent that places trades in one or more markets based on marginal costs or values
 *
 * This is an abstract class, meant to be subclassed for particular strategies.
 *
 */

export class Trader extends Agent {

  /**
   * @param {Object} [options] passed to Agent constructor(); Trader specific properties detailed below
   * @param {Array<Object>} [options.markets=[]] list of market objects where this agent acts on wake
   * @param {number} [options.minPrice=0] minimum price when submitting limit orders to buy
   * @param {number} [options.maxPrice=1000] maximum price when submitting sell limit orders to sell
   * @param {boolean} [options.ignoreBudgetConstraint=false] ignore budget constraint, substituting maxPrice for unit value when bidding, and minPrice for unit cost when selling
   * @listens {wake} to trigger sendBidsAndAsks()
   *
   */

  constructor(options) {
    const defaults = {
      description: 'Trader',
      markets: [],
      minPrice: 0,
      maxPrice: 1000
    };
    super(Object.assign({}, defaults, options));
    this.on('wake', this.sendBidsAndAsks);
  }

  /** send a limit order to buy one unit to the indicated market at myPrice. Placeholder throws error. Must be overridden and implemented in other code.
   * @abstract
   * @param {Object} market
   * @param {number} myPrice
   * @throws {Error} when calling placeholder
   */

  // eslint-disable-next-line no-unused-vars
  bid(market, myPrice) {
    throw new Error("called placeholder for abstract method .bid(market,myPrice) -- you must implement this method");
  }

  /**
   * send a limit order to sell one unit to the indicated market at myPrice. Placeholder throws error. Must be overridden and implemented in other code.
   * @abstract
   * @param {Object} market
   * @param {number} myPrice
   * @throws {Error} when calling placeholder
   */

  // eslint-disable-next-line no-unused-vars
  ask(market, myPrice) {
    throw new Error("called placeholder for abstract method .ask(market,myPrice) -- you must implement this method");
  }

  /**
   * calculate price this agent is willing to pay.  Placeholder throws error.  Must be overridden and implemented in other code.
   *
   * @abstract
   * @param {number} marginalValue The marginal value of redeeming the next unit.
   * @param {Object} market For requesting current market conditions, previous trade price, etc.
   * @return {number|undefined} agent's buy price or undefined if not willing to buy
   * @throws {Error} when calling placeholder
   */

  // eslint-disable-next-line no-unused-vars
  bidPrice(marginalValue, market) {
    throw new Error("called placeholder for abstract method .bidPrice(marginalValue, market) -- you must implement this method");
  }

  /**
   * calculate price this agent is willing to accept. Placeholder throws error. Must be overridden and implemented in other code.
   *
   *
   * @abstract
   * @param {number} marginalCost The marginal cost of producing the next unit.
   * @param {Object} market For requesting current market conditions, previous trade price, etc.
   * @return {number|undefined} agent's sell price or undefined if not willing to sell
   * @throws {Error} when calling placeholder
   */

  // eslint-disable-next-line no-unused-vars
  askPrice(marginalCost, market) {
    throw new Error("called placeholder for abstract method .bidPrice(marginalValue, market) -- you must implement this method");
  }

  /**
   * For each market in agent's configured markets, calculates agent's price strategy for buy or sell prices and then sends limit orders for 1 unit at those prices.
   * Normally you do not need to explicltly call this function: the wake listener set in the constructor of Trader and subclasses calls sendBidsAndAsks() automatcally on each wake event.
   *
   *
   */

  sendBidsAndAsks() {
    for (let i = 0, l = this.markets.length;i < l;++i) {
      let market = this.markets[i];
      let unitValue = this.unitValueFunction(market.goods, this.inventory);
      if (unitValue > 0) {
        if (this.ignoreBudgetConstraint)
          unitValue = this.maxPrice;
        let myPrice = this.bidPrice(unitValue, market); // calculate my buy price proposal
        if (myPrice)
          this.bid(market, myPrice); // send my price proposal
      }
      let unitCost = this.unitCostFunction(market.goods, this.inventory);
      if (unitCost > 0) {
        if (this.ignoreBudgetConstraint)
          unitCost = this.minPrice;
        let myPrice = this.askPrice(unitCost, market); // calculate my sell price proposal
        if (myPrice)
          this.ask(market, myPrice); // send my price proposal
      }
    }
  }

}

export class DoNothingAgent extends Trader {

  /**
   * creates do-nothing agent that never sends any bids or asks
   * @param {Object} [options] passed to Trader and Agent constructors
   */

  constructor(options) {
    super(Object.assign({}, { description: 'DoNothing agent never bids or asks', color:"black" }, options));
  }

  bidPrice() {
    return undefined;
  }

  askPrice() {
    return undefined;
  }
}

export class TruthfulAgent extends Trader {

  /**
   * creates "Truthful" robot agent that always sends bids at marginalValue or asks at marginalCost
   *
   * @param {Object} [options] passed to Trader and Agent constructors
   *
   */

  constructor(options) {
    super(Object.assign({}, { description: 'Truthful Agent bids=value or asks=cost', color:"turquoise" }, options));
  }

  bidPrice(marginalValue) {
    if (typeof(marginalValue) !== 'number') return undefined;
    return (this.integer) ? Math.floor(marginalValue) : marginalValue;
  }

  askPrice(marginalCost) {
    if (typeof(marginalCost) !== 'number') return undefined;
    return (this.integer) ? Math.ceil(marginalCost) : marginalCost;
  }

}

export class HoarderAgent extends Trader {

  /**
   * creates "Hoarder" robot agent that always buys 1 unit at the current asking price.
   * Hoarder agent never sells units, and disregards marginalValue, and so will sometimes overpay relative to value.
   * Hoarder does not interact with an empty market.
   *
   */

  constructor(options) {
    super(Object.assign({}, { description: 'Hoarder Agent always bids the current asking price and never asks', color:"hotpink" }, options));
  }

  bidPrice(marginalValue, market) {
    const currentAskPrice = market.currentAskPrice();
    if (currentAskPrice > 0)
      return currentAskPrice; // Hoarder will send order to buy 1 unit at the current asking price
  }

  askPrice() {
    return undefined; // Hoarder never sells
  }
}

/**
 * a reimplementation of Gode and Sunder's "Zero Intelligence" robots, as described in the economics research literature.
 *
 * see
 *
 *    Gode,  Dhananjay  K.,  and  S.  Sunder.  [1993].  ‘Allocative  efficiency  of  markets  with  zero-intelligence  traders:  Market  as  a  partial  substitute  for  individual  rationality.’    Journal  of  Political  Economy, vol. 101, pp.119-137.
 *
 *    Gode, Dhananjay K., and S. Sunder. [1993b]. ‘Lower bounds for efficiency of surplus extraction in double auctions.’  In  Friedman,  D.  and  J.  Rust  (eds).  The  Double  Auction  Market:  Institutions,  Theories,  and Evidence,  pp. 199-219.
 *
 *    Gode,  Dhananjay  K.,  and  S.  Sunder.  [1997a].  ‘What  makes  markets  allocationally  efficient?’  Quarterly Journal of Economics, vol. 112 (May), pp.603-630.
 *
 */

export class ZIAgent extends Trader {

  /**
   * creates "Zero Intelligence" robot agent similar to those described in Gode and Sunder (1993)
   *
   * @param {Object} [options] passed to Trader and Agent constructors()
   * @param {boolean} [options.integer] true instructs pricing routines to use positive integer prices, false allows positive real number prices
   */

  constructor(options) {
    super(Object.assign({}, { description: 'Gode and Sunder Style ZI Agent', color:"gold" }, options));
  }

  /**
   * calculate price this agent is willing to pay as a uniform random number ~ U[minPrice, marginalValue] inclusive.
   * If this.integer is true, the returned price will be an integer.
   *
   *
   * @param {number} marginalValue the marginal value of redeeming the next unit. sets the maximum price for random price generation
   * @return {number|undefined} randomized buy price or undefined if marginalValue non-numeric or less than this.minPrice
   */

  bidPrice(marginalValue) {
    if (typeof(marginalValue) !== 'number') return undefined;
    let p;
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

  /**
   * calculate price this agent is willing to accept as a uniform random number ~ U[marginalCost, maxPrice] inclusive.
   * If this.integer is true, the returned price will be an integer.
   *
   *
   * @param {number} marginalCost the marginal coat of producing the next unit. sets the minimum price for random price generation
   * @return {number|undefined} randomized sell price or undefined if marginalCost non-numeric or greater than this.maxPrice
   */

  askPrice(marginalCost) {
    if (typeof(marginalCost) !== 'number') return undefined;
    let p;
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
}

const um1p2 = ProbJS.uniform(-1, 2);
const um1p1 = ProbJS.uniform(-1, 1);

/**
 * Unit agent: uses ZIAgent algorithm if there is no previous market price, afterward, bids/asks randomly within 1 price unit of previous price
 *
 * see also Brewer, Paul Chapter 4 in Handbook of Experimental Economics Results, Charles R. Plott and Vernon L. Smith, eds.,  Elsevier: 2008
 *
 * Chapter available on Google Books at https://books.google.com search for "Handbook of Experimental Economics Results" and go to pp. 31-45.
 * or on Science Direct (paywall) at http://www.sciencedirect.com/science/article/pii/S1574072207000042
 *
 *
 *
 */

export class UnitAgent extends ZIAgent {

  /**
   * creates "Unit" robot agent similar to those described in Brewer(2008)
   *
   * @param {Object} [options] passed to Trader and Agent constructors()
   */

  constructor(options) {
    const defaults = {
      description: "Paul Brewer's UNIT agent that bids/asks within 1 price unit of previous price",
      color: 'violet'
    };
    super(Object.assign({}, defaults, options));
  }

  /**
   * calculates random change from previous transaction price
   * @return {number} a uniform random number on [-1,1]; or, if this.integer is set, picked randomly from the set {-1,0,1}
   */

  randomDelta() {
    let delta;
    if (this.integer) {
      do {
        delta = Math.floor(um1p2());
      } while ((delta <= -2) || (delta >= 2.0));
    } else {
      do {
        delta = um1p1();
      } while ((delta < -1) || (delta > 1));
    }
    return delta;
  }

  /**
   * Calculate price this agent is willing to pay.
   * The returned price is within one price unit of the previous market trade price, or uses the ZIAgent random algorithm if there is no previous market trade price.
   * Undefined (no bid) is returned if the propsed price would exceed the marginalValue parameter
   * If this.integer is true, the returned price will be an integer.
   *
   *
   * @param {number} marginalValue the marginal value of redeeming the next unit. sets the maximum price for allowable random price generation
   * @param {Object} market The market for which a bid is being prepared.  An object with lastTradePrice() method.
   * @return {number|undefined} agent's buy price or undefined
   */

  bidPrice(marginalValue, market) {
    let p;
    if (typeof(marginalValue) !== 'number') return undefined;
    const previous = market.lastTradePrice();
    if (previous)
      p = previous + this.randomDelta();
    else
      p = super.bidPrice(marginalValue);
    if ((p > marginalValue) || (p > this.maxPrice) || (p < this.minPrice)) return undefined;
    return (p && this.integer) ? Math.floor(p) : p;
  }

  /**
   * Calculate price this agent is willing to accept.
   * The returned price is within one price unit of the previous market trade price, or uses the ZIAgent random algorithm if there is no previous market trade price.
   * Undefined (no ask) is returned if the propsed price would be lower than the marginalCost parameter
   * If this.integer is true, the returned price will be an integer.
   *
   *
   * @param {number} marginalCost the marginal cost of producing the next unit. sets the minimum price for allowable random price generation
   * @param {Object} market The market for which a bid is being prepared.  An object with lastTradePrice() method.
   * @return {number|undefined} agent's buy price or undefined
   */

  askPrice(marginalCost, market) {
    if (typeof(marginalCost) !== 'number') return undefined;
    let p;
    const previous = market.lastTradePrice();
    if (previous)
      p = previous + this.randomDelta();
    else
      p = super.askPrice(marginalCost);
    if ((p < marginalCost) || (p > this.maxPrice) || (p < this.minPrice)) return undefined;
    return (p && this.integer) ? Math.floor(p) : p;
  }
}

/**
 * OneupmanshipAgent is a robotic version of that annoying market participant who starts at extremely high or low price, and always bid $1 more, or ask $1 less than any competition
 *
 */

export class OneupmanshipAgent extends Trader {

  /**
   * create OneupmanshipAgent
   * @param {Object} [options] Passed to Trader and Agent constructors
   *
   */

  constructor(options) {
    const defaults = {
      description: "Brewer's OneupmanshipAgent that increases the market bid or decreases the market ask by one price unit, if profitable to do so according to MV or MC",
      color: 'orange'
    };
    super(Object.assign({}, defaults, options));
  }

  /**
   * Calculate price this agent is willing to pay.
   * The returned price is either this.minPrice (no bidding), or market.currentBidPrice()+1, or undefined.
   * Undefined (no bid) is returned if the propsed price would exceed the marginalValue parameter
   * this.integer is ignored
   *
   *
   * @param {number} marginalValue the marginal value of redeeming the next unit. sets the maximum price for allowable bidding
   * @param {Object} market The market for which a bid is being prepared.  An object with currentBidPrice() and currentAskPrice() methods.
   * @return {number|undefined} agent's buy price or undefined
   */

  bidPrice(marginalValue, market) {
    if (typeof(marginalValue) !== 'number') return undefined;
    const currentBid = market.currentBidPrice();
    if (!currentBid)
      return this.minPrice;
    if (currentBid < (marginalValue - 1))
      return currentBid + 1;
  }

  /**
   * Calculate price this agent is willing to accept.
   * The returned price is either this.maxPrice (no asks), or market.currentAskPrice()-1, or undefined.
   * Undefined (no bid) is returned if the propsed price is less than the marginalCost parameter
   * this.integer is ignored
   *
   *
   * @param {number} marginalCost the marginal cost of producing the next unit. sets the minimum price for allowable bidding
   * @param {Object} market The market for which a bid is being prepared.  An object with currentBidPrice() and currentAskPrice() methods.
   * @return {number|undefined} agent's buy price or undefined
   */

  askPrice(marginalCost, market) {
    if (typeof(marginalCost) !== 'number') return undefined;
    const currentAsk = market.currentAskPrice();
    if (!currentAsk)
      return this.maxPrice;
    if (currentAsk > (marginalCost + 1))
      return currentAsk - 1;
  }

}

/**
 * MidpointAgent - An agent that bids/asks halfway between the current bid and current ask.
 *   When there is no current bid or current ask, the agent bids minPrice or asks maxPrice.
 *
 */

export class MidpointAgent extends Trader {
  constructor(options) {
    const defaults = {
      description: "Brewer's MidpointAgent bids/asks halfway between the bid and ask, if profitable to do according to MC or MV",
      color: 'mintcream'
    };
    super(Object.assign({}, defaults, options));
  }

  /**
   * Calculate price this agent is willing to pay.
   * The returned price is either the min price, the midpoint of the bid/ask, or undefined.
   * Undefined (no bid) is returned if the propsed price would exceed the marginalValue parameter
   * this.integer==true  causes midpoint prices to be rounded up to the next integer before comparison with marginalValue
   *
   * @param {number} marginalValue the marginal value of redeeming the next unit. sets the maximum price for allowable bidding
   * @param {Object} market The market for which a bid is being prepared.  An object with currentBidPrice() and currentAskPrice() methods.
   * @return {number|undefined} agent's buy price or undefined
   */

  bidPrice(marginalValue, market) {
    if (typeof(marginalValue) !== 'number') return undefined;
    const currentBid = market.currentBidPrice();
    if (!currentBid)
      return (this.minPrice <= marginalValue) ? this.minPrice : undefined;
    const currentAsk = market.currentAskPrice();
    if (currentAsk) {
      const midpoint = (currentBid + currentAsk) / 2;
      const myBid = (this.integer) ? Math.ceil(midpoint) : midpoint;
      if (myBid <= marginalValue)
        return myBid;
    }
  }

  /**
   * Calculate price this agent is willing to accept.
   * The returned price is either the max price, the midpoint of the bid/ask, or undefined.
   * Undefined (no ask) is returned if the propsed price is less than the marginalCost parameter
   * this.integer==true  causes midpoint prices to be rounded up to the next integer before comparison with marginalValue
   *
   *
   * @param {number} marginalCost the marginal cost of producing the next unit. sets the minimum price for allowable bidding
   * @param {Object} market The market for which a bid is being prepared.  An object with currentBidPrice() and currentAskPrice() methods.
   * @return {number|undefined} agent's buy price or undefined
   */

  askPrice(marginalCost, market) {
    if (typeof(marginalCost) !== 'number') return undefined;
    const currentAsk = market.currentAskPrice();
    if (!currentAsk)
      return (this.maxPrice >= marginalCost) ? this.maxPrice : undefined;
    const currentBid = market.currentBidPrice();
    if (currentBid) {
      const midpoint = (currentBid + currentAsk) / 2;
      const myAsk = (this.integer) ? Math.floor(midpoint) : midpoint;
      if (myAsk >= marginalCost)
        return myAsk;
    }
  }

}


export class Sniper extends Trader {
  constructor(options) {
    const defaults = {
      buyOnCloseTime: 0,
      sellOnCloseTime: 0
    };
    super(Object.assign({}, defaults, options));
  }

  buyNow() {
    throw new Error("buyNow() remains abstract");
  }

  sellNow() {
    throw new Error("sellNow() remains abstract");
  }

  bidPrice(marginalValue, market) {
    if (typeof(marginalValue) !== 'number') return undefined;
    const currentAsk = market.currentAskPrice();
    if (currentAsk <= marginalValue) {
      if (this.buyNow(marginalValue, market)) return currentAsk;
      if ((this.buyOnCloseTime > 0) && (this.wakeTime >= this.buyOnCloseTime)) return currentAsk;
    }
  }

  askPrice(marginalCost, market) {
    if (typeof(marginalCost) !== 'number') return undefined;
    const currentBid = market.currentBidPrice();
    if (currentBid >= marginalCost) {
      if (this.sellNow(marginalCost, market)) return currentBid;
      if ((this.sellOnCloseTime > 0) && (this.wakeTime >= this.sellOnCloseTime)) return currentBid;
    }
  }

}

/**
 * a reimplementation of a Kaplan Sniper Agent (JavaScript implementation by Paul Brewer)
 *
 * see e.g. "High Performance Bidding Agents for the Continuous Double Auction"
 *                Gerald Tesauro and Rajarshi Das, Institute for Advanced Commerce, IBM
 *
 *  http://researcher.watson.ibm.com/researcher/files/us-kephart/dblauc.pdf
 *
 *      for discussion of Kaplan's Sniper traders on pp. 4-5
 */

export class KaplanSniperAgent extends Sniper {

  /**
   * Create KaplanSniperAgent
   *
   * @param {Object} [options] options passed to Trader and Agent constructors
   * @param {number} [options.desiredSpread=10] desiredSpread for sniping; agent will accept trade if ||market.currentAskPrice()-market.currentBidPrice()||<=desiredSpread
   */

  constructor(options) {
    const defaults = {
      description: "Kaplan's snipers, trade on 'juicy' price, or low spread, or end of period",
      desiredSpread: 10,
      nearEndOfPeriod: 10,
      color: 'khaki'
    };
    super(Object.assign({}, defaults, options));
  }

  /**
   * Calculates price this agent is willing to pay.
   * The returned price always equals either undefined or the price of market.currentAsk(), triggering an immediate trade.
   *
   * The KaplanSniperAgent will buy, if market.currentAskPrice<=marginalValue,  during one of three conditions:
   * (A) market ask price is less than or equal to .getJuicyAskPrice(), which needs to be set at the simulation level to the previous period low trade price
   * (B) when spread = (market ask price - market bid price) is less than or equal to agent's desiredSpread (default: 10)
   * (C) when period is ending
   *
   */

  isLowSpread(market) {
    const currentBid = market.currentBidPrice();
    const currentAsk = market.currentAskPrice();
    return ((currentAsk > 0) && (currentBid > 0) && ((currentAsk - currentBid) <= this.desiredSpread));
  }

  buyNow(marginalValue, market) {
    const isJuicyPrice = (market.currentAskPrice() <= market.previousPeriod('lowPrice'));
    if (isJuicyPrice) return true;
    if (this.isLowSpread(market)) return true;
    /* istanbul ignore else */
    if (this.poissonWakesRemainingInPeriod() <= this.nearEndOfPeriod) return true;
  }

  sellNow(marginalCost, market) {
    const isJuicyPrice = (market.currentBidPrice() >= market.previousPeriod('highPrice'));
    if (isJuicyPrice) return true;
    if (this.isLowSpread(market)) return true;
    /* istanbul ignore else */
    if (this.poissonWakesRemainingInPeriod() <= this.nearEndOfPeriod) return true;
  }

}

export class MedianSniperAgent extends Sniper {

  /**
   * Create MedianSniperAgent
   *
   * @param {Object} [options] options passed to Trader and Agent constructors
   */

  constructor(options) {
    const defaults = {
      description: "Median snipers, trade on price better than previous period median, or at end of period",
      nearEndOfPeriod: 10,
      color: 'magenta'
    };
    super(Object.assign({}, defaults, options));
  }

  buyNow(marginalValue, market) {
    if (market.currentAskPrice() <= market.previousPeriod('medianPrice')) return true;
    /* istanbul ignore else */
    if (this.poissonWakesRemainingInPeriod() <= this.nearEndOfPeriod) return true;
  }

  sellNow(marginalCost, market) {
    if (market.currentBidPrice() >= market.previousPeriod('medianPrice')) return true;
    /* istanbul ignore else */
    if (this.poissonWakesRemainingInPeriod() <= this.nearEndOfPeriod) return true;
  }
}

export class AcceptSniperAgent extends Sniper {

  /**
    * Create AcceptSniperAgent from Sniper
    * @param {Object} [options] to Trader and Agent constructors
    */

  constructor(options){
    const defaults = {
      description: "AcceptSniperAgent, accepts any bid/ask from other side of market that meets no-loss constraint but does not make bids/asks",
      color: 'antiquewhite'
    };
    super(Object.assign({},defaults,options));
  }

  buyNow(){ return true; }

  sellNow(){ return true; }

}


export class RandomAcceptSniperAgent extends Sniper {

  /**
    * Create RandomAcceptSniperAgent from Sniper
    * @param {Object} [options] to Trader and Agent constructors
    */

  constructor(options){
    const defaults = {
      description: "RandomAcceptSniperAgent, at a probability between 0-1 (also determined randomly, once, at initialization) randomly accepts any bid/ask from other side of market that meets no-loss constraint. Does not make bids/asks",
      color: 'red'
    };
    super(Object.assign({},defaults,options));
    this.acceptRate = ProbJS.uniform(0.0,1.0);
  }

  accept(){
    const r = ProbJS.uniform(0.0,1.0);
    if (r<=this.acceptRate) return true;
    return false;
  }

  buyNow(){
    return this.accept();
  }

  sellNow(){
    return this.accept();
  }
}

export class FallingAskSniperAgent extends Sniper {

  constructor(options){
    const defaults = {
      description: 'Sniper waits for Ask below previous trade price',
      color: 'forestgreen'
    };
    super(Object.assign({},defaults,options));
  }

  isFallingAsk(market){
    const last = market.lastTradePrice();
    const ask = market.currentAskPrice();
    return ((last>0) && (ask>0) && (ask<last));
  }

  buyNow(marginalValue,market){
    return this.isFallingAsk(market);
  }

  sellNow(marginalCost,market){
    return this.isFallingAsk(market);
  }

}

export class RisingBidSniperAgent extends Sniper {
  constructor(options){
    const defaults = {
      description: 'Sniper waits for Bid above previous trade price',
      color: 'rosybrown'
    };
    super(Object.assign({},defaults,options));
  }

  isRisingBid(market){
    const last = market.lastTradePrice();
    const bid = market.currentBidPrice();
    return ((last>0) && (bid>0) && (bid>last));
  }

  buyNow(marginalValue,market){
    return this.isRisingBid(market);
  }

  sellNow(marginalCost,market){
    return this.isRisingBid(market);
  }

}

/**
 * Pool for managing a collection of agents.
 * Agents may belong to multiple pools.
 *
 */

export class Pool {
  constructor() {
    this.agents = [];
    this.agentsById = {};
  }

  /**
   * Add an agent to the Pool
   * @param {Object} agent to add to pool.  Should be instanceof Agent, including subclasses.
   */

  push(agent) {
    if (!(agent instanceof Agent))
      throw new Error("Pool.push(agent), agent is not an instance of Agent or descendents");
    if (this.agentsById[agent.id]) {
      throw new Error("Pool.push(agent), conflict: new agent has id of existing agent");
    }
    this.agents.push(agent);
    this.agentsById[agent.id] = agent;
  }

  /**
   * finds agent from Pool with lowest wakeTime
   * @return {Object}
   */

  next() {
    if (this.nextCache) return this.nextCache;
    let tMin = 1e20,
      i = 0,
      l = this.agents.length,
      A = this.agents,
      t = 0,
      result = 0;
    for (; i < l;i++) {
      t = A[i].wakeTime;
      if ((t > 0) && (t < tMin)) {
        result = A[i];
        tMin = t;
      }
    }
    this.nextCache = result;
    return result;
  }

  /**
   * wakes agent in Pool with lowest wakeTime
   */

  wake() {
    const A = this.next();
    /* istanbul ignore else */
    if (A) {
      A.wake();
      // wipe nextCache
      delete this.nextCache;
    }
  }

  /**
   * finds latest period.endTime of all agent in Pool
   * @return {number} max of agents period.endTime
   */

  endTime() {
    let endTime = 0;
    for (let i = 0, l = this.agents.length;i < l;++i) {
      let a = this.agents[i];
      if (a.period.endTime > endTime)
        endTime = a.period.endTime;
    }
    if (endTime > 0) return endTime;
  }

  /**
   * Repeatedly wake agents in Pool, until simulation time "untilTime" is reached. For a synchronous equivalent, see syncRun(untilTime, limitCalls)
   *
   * @param {number} untilTime Stop time for this run
   * @param {number} batch Batch size of number of agents to wake up synchronously before surrendering to event loop
   * @return {Promise<Object,Error>} returns promise resolving to pool, with caught errors passed to reject handler.
   */

  runAsPromise(untilTime, batch) {
    const pool = this;
    return new Promise(function (resolve, reject) {
      function loop() {
        let nextAgent = 0;

        /* can not test catch() block so drop from test coverage */

        try {
          pool.syncRun(untilTime, (batch || 1));
          nextAgent = pool.next();
        } catch (e) /* istanbul ignore next */ { // eslint-disable-line brace-style
          return reject(e);
        }
        return (nextAgent && (nextAgent.wakeTime < untilTime)) ? setImmediate(loop) : resolve(pool);
      }
      setImmediate(loop);
    });
  }

  /**
   * Repeatedly wake agents in Pool, until simulation time "untilTime" or "limitCalls" agent wake calls are reached.
   * This method runs synchronously.  It returns only when finished.
   *
   * @param {number} untilTime Stop time for this run
   * @param {number} [limitCalls] Stop run once this number of agent wake up calls have been executed.
   *
   */

  syncRun(untilTime, limitCalls) {
    let nextAgent = this.next();
    let calls = 0;
    while (nextAgent && (nextAgent.wakeTime < untilTime) && (!(calls >= limitCalls))) {
      this.wake();
      nextAgent = this.next();
      calls++;
    }
  }

  /**
   * calls .initPeriod for all agents in the Pool
   *
   * @param {Object|number} param passed to each agent's .initPeriod()
   */

  initPeriod(param) {
    // passing param to all the agents is safe because Agent.initPeriod does a deep clone
    if (Array.isArray(param) && (param.length > 0)) {
      for (let i = 0, l = this.agents.length;i < l;i++)
        this.agents[i].initPeriod(param[i % (param.length)]);
    } else {
      for (let i = 0, l = this.agents.length;i < l;i++)
        this.agents[i].initPeriod(param);
    }
  }

  /**
   * calls .endPeriod for all agents in the Pool
   */

  endPeriod() {
    for (let i = 0, l = this.agents.length;i < l;i++)
      this.agents[i].endPeriod();
  }

  /**
   * adjusts Pool agents inventories, via agent.transfer(), in response to one or more trades
   * @param {Object} tradeSpec Object providing specifics of trades.
   * @param {string} tradeSpec.bs 'b' for buy trade, 's' for sell trade. In a buy trade, buyQ, buyId are single element arrays.  In a sell trade, sellQ, sellId are single element arrays,
   * @param {string} tradeSpec.goods the name of the goods, as stored in agent inventory object
   * @param {string} tradeSpec.money the name of money used for payment, as stored in agent inventory object
   * @param {number[]} tradeSpec.prices the price of each trade
   * @param {number[]} tradeSpec.buyId the agent id of a buyer in a trade
   * @param {number[]} tradeSpec.buyQ the number bought by the corresponding agent in .buyId
   * @param {number[]} tradeSpec.sellId the agent id of a seller in a trade
   * @param {number[]} tradeSPec.sellQ the number bought by he corresponding agent in .sellId
   * @throws {Error} when accounting identities do not balance or trade invalid
   */

  trade(tradeSpec) {
    let i, l, buyerTransfer, sellerTransfer;
    if (typeof(tradeSpec) === 'undefined') return;
    if ((typeof(tradeSpec) === 'object') &&
      (tradeSpec.bs) &&
      (tradeSpec.goods) &&
      (tradeSpec.money) &&
      (Array.isArray(tradeSpec.prices)) &&
      (Array.isArray(tradeSpec.buyQ)) &&
      (Array.isArray(tradeSpec.sellQ)) &&
      (Array.isArray(tradeSpec.buyId)) &&
      (Array.isArray(tradeSpec.sellId))) {
      if (tradeSpec.bs === 'b') {
        if (tradeSpec.buyId.length !== 1)
          throw new Error("Pool.trade expected tradeSpec.buyId.length===1, got:" + tradeSpec.buyId.length);
        if (tradeSpec.buyQ[0] !== sum(tradeSpec.sellQ))
          throw new Error("Pool.trade invalid buy -- tradeSpec buyQ[0] != sum(sellQ)");
        buyerTransfer = {};
        buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[0];
        buyerTransfer[tradeSpec.money] = -dot(tradeSpec.sellQ, tradeSpec.prices);
        this.agentsById[tradeSpec.buyId[0]].transfer(buyerTransfer, { isTrade: 1, isBuy: 1 });
        for (i = 0, l = tradeSpec.prices.length;i < l;++i) {
          sellerTransfer = {};
          sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[i];
          sellerTransfer[tradeSpec.money] = tradeSpec.prices[i] * tradeSpec.sellQ[i];
          this.agentsById[tradeSpec.sellId[i]].transfer(sellerTransfer, { isTrade: 1, isSellAccepted: 1 });
        }
      } else if (tradeSpec.bs === 's') {
        if (tradeSpec.sellId.length !== 1)
          throw new Error("Pool.trade expected tradeSpec.sellId.length===1. got:" + tradeSpec.sellId.length);
        if (tradeSpec.sellQ[0] !== sum(tradeSpec.buyQ))
          throw new Error("Pool.trade invalid sell -- tradeSpec sellQ[0] != sum(buyQ)");
        sellerTransfer = {};
        sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[0];
        sellerTransfer[tradeSpec.money] = dot(tradeSpec.buyQ, tradeSpec.prices);
        this.agentsById[tradeSpec.sellId[0]].transfer(sellerTransfer, { isTrade: 1, isSell: 1 });
        for (i = 0, l = tradeSpec.prices.length;i < l;++i) {
          buyerTransfer = {};
          buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[i];
          buyerTransfer[tradeSpec.money] = -tradeSpec.prices[i] * tradeSpec.buyQ[i];
          this.agentsById[tradeSpec.buyId[i]].transfer(buyerTransfer, { isTrade: 1, isBuyAccepted: 1 });
        }
      } else {
        throw new Error("Pool.trade tradeSpec.bs must be b or s, got:"+tradeSpec.bs);
      }
    } else {
      throw new Error("Pool.trade tradeSpec object not in correct format");
    }
  }

  /**
   * distribute an aggregate setting of buyer Values or seller Costs to a pool of sellers, by giving each agent a successive value from the array without replacement
   *
   * @param {string} field "values" or "costs"
   * @param {good} good name of good for agents inventories.
   * @param {number[]} aggregateArray list of numeric values or costs reflecting the aggregate pool values or costs
   * @throws {Error} when field is invalid or aggregateArray is wrong type
   */

  distribute(field, good, aggregateArray) {
    let i, l;
    let myCopy;
    if (Array.isArray(aggregateArray)) {
      myCopy = aggregateArray.slice();
    } else {
      throw new Error("Error: Pool.prototype.distribute: expected aggregate to be Array, got: " + typeof(aggregateArray));
    }
    if ((field !== 'values') && (field !== 'costs'))
      throw new Error("Pool.distribute(field,good,aggArray) field should be 'values' or 'costs', got:" + field);
    for (i = 0, l = this.agents.length;i < l;++i) {
      // the if statement probably would never be satisfied -- but better to fix missing field than throw an error
      /* istanbul ignore next */
      if (typeof(this.agents[i][field]) === 'undefined')
        this.agents[i][field] = {};
      this.agents[i][field][good] = [];
    }
    i = 0;
    l = this.agents.length;
    while (myCopy.length > 0) {
      this.agents[i][field][good].push(myCopy.shift());
      i = (i + 1) % l;
    }
  }
}
