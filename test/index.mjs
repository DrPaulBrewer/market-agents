/* eslint-env node, mocha */

import assert from 'assert';
import "should";
import * as MarketAgents from "../src/index.mjs";

const {
  Agent,
  ZIAgent,
  ZIJumpAgent,
  ZISpreadAgent,
  TTAgent,
  Pool,
  UnitAgent,
  OneupmanshipAgent,
  MidpointAgent,
  DoNothingAgent,
  TruthfulAgent,
  DPPAgent,
  HoarderAgent,
  KaplanSniperAgent,
  MedianSniperAgent,
  AcceptSniperAgent,
  RandomAcceptSniperAgent,
  FallingAskSniperAgent,
  RisingBidSniperAgent
} = MarketAgents;

function testInclusiveUniformity({range, multiple=10000, sigma=5, integer=true, f}={}){
  const [rangeL, rangeH] = range;
  if (
    (rangeL!==Math.floor(rangeL)) ||
    (rangeH!==Math.floor(rangeH))
  ) throw new RangeError("range [L,H] must be integers");
  const totalBins = rangeH-rangeL+1;
  const bins = new Array(totalBins).fill(0);
  const totalCalls = totalBins*multiple;
  for(let i=0;i<totalCalls;i++){
    // if integer:true then we will be testing in the assert that f is an integer
    // if integer:false then we will assume f is non-integer and bin by Math.floor
    const x = (integer)? f(): Math.floor(f());
    assert.strictEqual(x,Math.floor(x),"expected an integer");
    x.should.be.within(rangeL,rangeH);
    bins[x-rangeL]++;
  }
  let sumsq = 0;
  for(let i=0;i<totalBins;++i){
    assert.ok(bins[i]>0, "bin "+i+" for "+(rangeL+i)+" empty");
    const e = bins[i] - multiple;
    sumsq += (e*e);
  }
  const chisqsum = sumsq/multiple;
  const degreesOfFreedom = totalBins-1;
  // use Fisher's 1922 normality approximation see Wikipedia: Chi-square_distribution
  const norm = Math.sqrt(2*chisqsum)-Math.sqrt(2*degreesOfFreedom-1);
  norm.should.be.within(-sigma,sigma);
  return norm;
}

/**  @test {MarketAgents} */

describe('MarketAgents', function () {

  it('should be an object', function () {
    assert.ok(typeof(MarketAgents)==='object');
  });

  let props = ['Agent', 'ZIAgent', 'UnitAgent', 'MidpointAgent', 'KaplanSniperAgent', 'MedianSniperAgent', 'Pool'];

  props.forEach(function(prop){
    it('should have [constructor] function  '+prop, function(){
      assert.ok(typeof(MarketAgents[prop])==='function');
    });
  });

});

/** @test {Agent} */

describe('new Agent', function () {
  it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
    function () {
      let myAgent = new Agent();
      myAgent.should.be.type('object');
      myAgent.should.have.properties('id', 'description', 'inventory', 'wakeTime', 'rate', 'nextWake', 'period');
      myAgent.id.should.be.type('number');
      myAgent.description.should.be.type('string');
      myAgent.inventory.should.be.type('object');
      myAgent.wakeTime.should.be.type('number');
      myAgent.rate.should.be.type('number');
      myAgent.nextWake.should.be.type('function');
      myAgent.period.should.be.type('object');
    });

  it('should have ascending default id number', function () {
    let agent1 = new Agent();
    let agent2 = new Agent();
    assert.ok(agent1.id > 0);
    assert.ok(agent2.id > 0);
    assert.ok(agent2.id > agent1.id);
  });

  it('.nextWake() should yield undefined when .wakeTime is set undefined', function(){
    let a = new Agent();
    a.wakeTime = undefined;
    assert.strictEqual(a.nextWake(),undefined);
  });

  it('test 100 wakes, should have ascending wake times', function () {
    let agent = new Agent();
    let i, l;
    let t0, t1;
    let wakes = 0;
    agent.on('wake', function () { wakes++; });
    for (i = 0, l = 100;i < l;++i) {
      t0 = agent.wakeTime;
      agent.wake();
      t1 = agent.wakeTime;
      assert.ok(t1 > t0, `(loop i=${i}) ${t1} > ${t0}`);
    }
    assert.ok(wakes === 100);
  });

  it('test 10000 wakes, agent with rate 2 should use between 1/4 and 3/4 the time of agent with rate 1', function () {
    let agent1 = new Agent();
    let agent2 = new Agent({ rate: 2 });
    let i, l;
    let wakes1 = 0,
      wakes2 = 0;
    agent1.on('wake', function () { wakes1++; });
    agent2.on('wake', function () { wakes2++; });
    for (i = 0, l = 10000;i < l;++i) {
      agent1.wake();
      agent2.wake();
    }
    assert.ok(wakes1 === 10000);
    assert.ok(wakes2 === 10000);
    assert.ok(agent2.wakeTime > (0.25 * agent1.wakeTime), `${agent1.wakeTime} ${agent2.wakeTime}`);
    assert.ok(agent2.wakeTime < (0.75 * agent1.wakeTime), `${agent1.wakeTime} ${agent2.wakeTime}`);
  });

  it('test 10000 wakes, agent with rate 10 should use between 0.05 and 0.15 the time of agent with rate 1', function () {
    let agent1 = new Agent();
    let agent2 = new Agent({ rate: 10 });
    let i, l;
    let wakes1 = 0,
      wakes2 = 0;
    agent1.on('wake', function () { wakes1++; });
    agent2.on('wake', function () { wakes2++; });
    for (i = 0, l = 10000;i < l;++i) {
      agent1.wake();
      agent2.wake();
    }
    assert.ok(wakes1 === 10000);
    assert.ok(wakes2 === 10000);
    assert.ok(agent2.wakeTime > (0.05 * agent1.wakeTime), `${agent1.wakeTime} ${agent2.wakeTime}`);
    assert.ok(agent2.wakeTime < (0.15 * agent1.wakeTime), `${agent1.wakeTime} ${agent2.wakeTime}`);
  });

  it('agent with rate 0, wakes at +Infinity', function(){
    const a = new Agent({rate: 0});
    a.wakeTime.should.equal(+Infinity);
  });

  it('with period.endTime set wake up to 10000 times until wakeTime is undefined; .wakeTime, .pctPeriod increasing, .poissonWakesRemainingInPeriod decreasing, check formulas for pct, wakes', function () {
    // set rate to something other than 1 to test as 1/1===1 and reciprocal error could creep in
    let agent = new Agent({ rate: 2.7 });
    agent.initPeriod(0);
    assert.ok(agent.period.endTime > 0);
    let j = 0;
    let lastWakeTime = 0;
    let lastPctPeriod = 0;
    let lastRemaining = Infinity;
    let wakeTime = agent.wakeTime,
      pctPeriod, remaining;
    let approxRemaining;
    while (agent.wakeTime && (++j < 10000)) {
      pctPeriod = agent.pctPeriod();
      remaining = agent.poissonWakesRemainingInPeriod();
      wakeTime.should.be.above(lastWakeTime);
      pctPeriod.should.be.above(lastPctPeriod);
      pctPeriod.should.be.approximately((agent.wakeTime - agent.period.startTime) / (agent.period.endTime - agent.period.startTime), 0.001);
      remaining.should.be.below(lastRemaining);
      approxRemaining = (agent.period.endTime - agent.wakeTime) * agent.rate;
      approxRemaining.should.be.type("number");
      remaining.should.be.approximately(approxRemaining, 0.001);
      assert.ok((pctPeriod > 0) && (pctPeriod < 1));
      assert.ok(remaining > 0);
      lastWakeTime = wakeTime;
      lastPctPeriod = pctPeriod;
      lastRemaining = remaining;
      agent.wake();
      wakeTime = agent.wakeTime;
    }
    assert.ok(j > 100);
    assert.ok(agent.wakeTime === undefined);
  });

  it('wake 10000 times with no period.endTime yields .wakeTime within [9500,10500]', function () {
    let agent = new Agent();
    let i, l;
    if (agent.period.endTime)
      delete agent.period.endTime;
    for (i = 0, l = 10000;i < l;++i)
      agent.wake();
    agent.wakeTime.should.be.within(9500, 10500);
  });

  describe('agent-period cycle interactions', function () {
    function setup() {
      let someMoneyNoX = { money: 1000, X: 0 };
      let period = { number: 0, duration: 1000, equalDuration: true, init: { inventory: someMoneyNoX } };
      let agent0 = new Agent();
      let agent1 = new Agent();
      agent0.initPeriod(period);
      agent1.initPeriod(period);
      return [agent0, agent1];
    }
    it('should initially be at period 0', function () {
      let agents = setup();
      agents[0].period.number.should.equal(0);
      agents[1].period.number.should.equal(0);
    });
    it('agents 1,2  should show initial inventory 0 X 1000 Money', function () {
      let agents = setup();
      assert.ok(agents[0].inventory.X === 0);
      assert.ok(agents[0].inventory.money === 1000);
      assert.ok(agents[1].inventory.X === 0);
      assert.ok(agents[1].inventory.money === 1000);
    });
    it('after Transfer of +1X, -500 Money, agent 1 should show 1 X, 500 Money; agent 1 endowment, agent 2 unaffected', function () {
      let agents = setup();
      let buyOneXFor500 = { money: -500, X: 1 };
      agents[0].transfer(buyOneXFor500);
      assert.ok(agents[0].inventory.X === 1);
      assert.ok(agents[0].inventory.money === 500);
      assert.ok(agents[1].inventory.X === 0);
      assert.ok(agents[1].inventory.money === 1000);
    });
    it('agents should emit post-period when .endPeriod is called', function () {
      let agents = setup();
      let ended = [0, 0];
      agents.forEach(function (a, i) { a.on('post-period', function () { ended[i] = 1; }); });
      agents.forEach(function (a) { a.endPeriod(); });
      ended.should.deepEqual([1, 1]);
    });
    it('agents should indicate period number:1, startTime:1000, endTime:2000 after set with .initPeriod({number:1, ... })', function () {
      let agents = setup();
      let buyOneXFor500 = { money: -500, X: 1 };
      agents[0].transfer(buyOneXFor500);
      agents.forEach(function (a) { a.initPeriod(Object.assign({}, a.period, { number: 1 })); });
      agents.forEach(function (a) {
        assert.ok(a.period.number === 1);
        assert.ok(a.period.startTime === 1000);
        assert.ok(a.period.endTime === 2000);
      });
    });
    it('agents should indicate period number:1, startTime:1000, endTime:2000  after set with .initPeriod(1)', function () {
      let agents = setup();
      let buyOneXFor500 = { money: -500, X: 1 };
      agents[0].transfer(buyOneXFor500);
      agents.forEach(function (a) { a.initPeriod(1); });
      agents.forEach(function (a) {
        assert.ok(a.period.number === 1);
        assert.ok(a.period.startTime === 1000);
        assert.ok(a.period.endTime === 2000);
      });
    });
    it('agents 1,2, should show initial inventory 0 X, 1000 Money for Period 1', function () {
      let agents = setup();
      let buyOneXFor500 = { money: -500, X: 1 };
      agents[0].transfer(buyOneXFor500);
      agents.forEach(function (a) { a.initPeriod(Object.assign({}, a.period, { number: 1 })); });
      assert.ok(agents[0].inventory.X === 0);
      assert.ok(agents[0].inventory.money === 1000);
      assert.ok(agents[1].inventory.X === 0);
      assert.ok(agents[1].inventory.money === 1000);
    });
    it('agent 1 given 2Y should still have 2Y after period reset as Y amount unspecified in period.init.inventory', function () {
      let agents = setup();
      let give1Y = { Y: 1 };
      agents[0].transfer(give1Y);
      assert.ok(agents[0].inventory.Y === 1);
      agents.forEach(function (a) { a.initPeriod(Object.assign({}, a.period, { number: 1 })); });
      assert.ok(agents[0].inventory.X === 0);
      assert.ok(agents[0].inventory.money === 1000);
      assert.ok(agents[0].inventory.Y === 1);
      assert.ok(agents[1].inventory.X === 0);
      assert.ok(agents[1].inventory.money === 1000);
    });

    it('agent end of period redemption, zeroed X and correct end-of-period money balance', function () {
      let period1 = {
        number: 1,
        init: {
          inventory: { 'money': 1000, 'X': 0, 'Y': 1 },
          values: { 'X': [500, 400, 300, 200, 100, 1, 1, 1, 1, 1, 1, 1] }
        }
      };
      let agents = setup();
      agents[0].initPeriod(period1);
      agents[1].initPeriod(period1);
      agents[0].transfer({ 'X': 5 });
      agents[1].transfer({ 'X': 2 });
      agents[0].endPeriod();
      agents[1].endPeriod();
      // X inventory should be zero from redemption
      agents[0].inventory.X.should.equal(0);
      agents[1].inventory.X.should.equal(0);
      // Y inventory is unchanged because no values or costs
      agents[0].inventory.Y.should.equal(1);
      agents[1].inventory.Y.should.equal(1);
      agents[0].inventory.money.should.equal(2500);
      agents[1].inventory.money.should.equal(1900);
    });


    it('agent end of period production, zeroed X and correct end-of-period money balance', function () {
      let period1 = {
        number: 1,
        init: {
          inventory: { 'money': 1000, 'X': 0, 'Y': 1 },
          costs: { 'X': [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] }
        }
      };
      let agents = setup();
      agents[0].initPeriod(period1);
      agents[1].initPeriod(period1);
      agents[0].transfer({ 'X': -5 });
      agents[1].transfer({ 'X': -2 });
      agents[0].endPeriod();
      agents[1].endPeriod();
      // X inventory should be zero from cost
      agents[0].inventory.X.should.equal(0);
      agents[1].inventory.X.should.equal(0);
      // Y inventory is unchanged because no values or costs
      agents[0].inventory.Y.should.equal(1);
      agents[1].inventory.Y.should.equal(1);
      agents[0].inventory.money.should.equal(-500);
      agents[1].inventory.money.should.equal(700);
    });
  });
});

/** @test {Trader} */
describe('new Trader', function(){
  it('should initialize properties markets, minPrice, maxPrice', function(){
    const a = new MarketAgents.Trader({});
    a.should.have.properties({markets:[],minPrice:0,maxPrice:1000});
  });
  it('.bid, .ask, .bidPrice, .askPrice are abstract methods', function(){
    const a = new MarketAgents.Trader({});
    ['bid','ask','bidPrice','askPrice'].forEach((method)=>{
      a[method].should.throw(/abstract/);
    });
  });
});

/** @test {ZIAgent} */

describe('new ZIAgent', function () {
  it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
    function () {
      let myAgent = new ZIAgent();
      myAgent.should.be.type('object');
      myAgent.should.have.properties('id', 'description', 'inventory', 'wakeTime', 'rate', 'nextWake', 'period');
      myAgent.id.should.be.type('number');
      myAgent.description.should.be.type('string');
      myAgent.inventory.should.be.type('object');
      myAgent.wakeTime.should.be.type('number');
      myAgent.rate.should.be.type('number');
      myAgent.nextWake.should.be.type('function');
      myAgent.period.should.be.type('object');
    });

  it('should have properties markets, values, costs, minPrice, maxPrice with proper types', function () {
    let zi = new ZIAgent();
    zi.should.have.properties('markets', 'values', 'costs', 'minPrice', 'maxPrice');
    zi.markets.should.be.type('object');
    zi.values.should.be.type('object');
    zi.costs.should.be.type('object');
    zi.minPrice.should.be.type('number');
    zi.maxPrice.should.be.type('number');
  });

  it('should not call this.bid() or this.ask() on this.wake() if values and costs not configured', function () {
    let zi = new ZIAgent({ markets: [{ goods: 'X' }] });
    let wakes = 0,
      bids = 0,
      asks = 0;
    zi.on('wake', function () { wakes++; });
    zi.bid = function () { bids++; };
    zi.ask = function () { asks++; };
    zi.wake();
    wakes.should.equal(1);
    bids.should.equal(0);
    asks.should.equal(0);
  });

  it('should call this.bid() on this.wake() if values configured', function () {
    let zi = new ZIAgent({ markets: [{ goods: "X" }] });
    zi.initPeriod({ number: 0, startTime: 0, init: { inventory: { coins: 0, X: 0, Y: 0 }, values: { X: [100, 1, 1] } } });
    let wakes = 0,
      bids = 0,
      asks = 0;
    zi.on('wake', function () { wakes++; });
    zi.bid = function (market, p) {
      assert.ok(market.goods === 'X');
      p.should.be.type('number');
      p.should.be.within(0, 100);
      bids++;
    };
    zi.ask = function () { asks++; };
    zi.wake();
    wakes.should.equal(1);
    bids.should.equal(1);
    asks.should.equal(0);
  });

  it('should call this.ask() on this.wake() if costs configured', function () {
    let zi = new ZIAgent({ markets: [{ goods: "X" }] });
    zi.initPeriod({ number: 0, startTime: 0, init: { inventory: { coins: 0, X: 0, Y: 0 }, costs: { X: [100, 1000, 1000] } } });
    let wakes = 0,
      bids = 0,
      asks = 0;
    zi.on('wake', function () { wakes++; });
    zi.bid = function () {
      bids++;
    };
    zi.ask = function (market, p) {
      market.goods.should.equal('X');
      p.should.be.type('number');
      p.should.be.within(100, 1000);
      asks++;
    };
    zi.wake();
    wakes.should.equal(1);
    bids.should.equal(0);
    asks.should.equal(1);
  });

  it('should call this.bid() on Y market and this.ask() on X market on this.wake() if both values and  costs configured', function () {
    let zi = new ZIAgent({
      inventory: { coins: 0, X: 0, Y: 0 },
      markets: [{ goods: "X" }, { goods: "Y" }],
      costs: { X: [100] },
      values: { Y: [50] },
      maxPrice: 1000
    });
    let wakes = 0,
      bids = 0,
      asks = 0;
    zi.on('wake', function () { wakes++; });
    zi.bid = function (market, p) {
      bids++;
      market.goods.should.equal('Y');
      p.should.be.type('number');
      p.should.be.within(0, 100);
    };
    zi.ask = function (market, p) {
      market.goods.should.equal('X');
      p.should.be.type('number');
      p.should.be.within(50, 1000);
      asks++;
    };
    zi.wake();
    wakes.should.equal(1);
    bids.should.equal(1);
    asks.should.equal(1);
  });

  it('should not call this.bid() or this.ask() on this.wake() if this.bidPrice or this.askPrice returns falsey', function () {
    let zi = new ZIAgent({
      inventory: { coins: 0, X: 0, Y: 0 },
      markets: { X: 1, Y: 1 },
      costs: { X: [100] },
      values: { Y: [50] },
      maxPrice: 1000
    });
    zi.bidPrice = function () { return undefined; };
    zi.askPrice = function () { return 0; };
    let wakes = 0,
      bids = 0,
      asks = 0;
    zi.on('wake', function () { wakes++; });
    zi.bid = function () {
      bids++;
    };
    zi.ask = function () {
      asks++;
    };
    zi.wake();
    wakes.should.equal(1);
    bids.should.equal(0);
    asks.should.equal(0);
  });

  it('10000 tests this.bidPrice(v) should return number  between minPrice and v', function () {
    let zi = new ZIAgent();
    let i, l, p;
    for (i = 1, l = 10001;i < l;i++) {
      p = zi.bidPrice(i);
      p.should.be.within(0, i);
      Math.floor(p).should.not.equal(p);
    }
    zi.minPrice = 1;
    assert.ok(typeof(zi.bidPrice(0.5)) === 'undefined');
    zi.bidPrice(zi.minPrice).should.equal(zi.minPrice);
    zi.integer = true;
    for (i = 1, l = 10000;i < l;i++) {
      p = zi.bidPrice(i);
      p.should.be.within(1, i);
      Math.floor(p).should.equal(p);
    }
  });

  it('10000 tests this.askPrice(c) should return number between c and maxPrice', function () {
    let zi = new ZIAgent({ maxPrice: 12345 });
    let i, l, p;
    for (i = 1, l = 10001;i < l;i++) {
      p = zi.askPrice(i);
      p.should.be.within(i, 12345);
      Math.floor(p).should.not.equal(p);
    }
    zi.maxPrice = 11111;
    assert.ok(typeof(zi.askPrice(22222)) === 'undefined');
    zi.integer = true;
    for (i = 1, l = 10000;i < l;++i) {
      p = zi.askPrice(i);
      p.should.be.within(i, 11111);
      Math.floor(p).should.equal(p);
    }
    zi.askPrice(zi.maxPrice).should.equal(zi.maxPrice);
  });

  it('10000 wake test with ignoreBudgetConstraint,  integer: this.bidPrice(50) should return every number between this.minPrice and this.maxPrice inclusive',
    function () {
      let zi = new ZIAgent({
        integer: true,
        ignoreBudgetConstraint: true,
        minPrice: 10,
        maxPrice: 90,
        inventory: { money: 0, X: 0 },
        values: { X: [20] },
        markets: [{ 'goods': 'X' }]
      });
      let i, l, total = 0;
      let bins = Array(100).fill(0);
      zi.bid = function (market, p) {
        Math.floor(p).should.equal(p);
        total++;
        bins[p]++;
      };
      for (i = 0, l = 10000;i < l;++i) {
        zi.wake();
      }
      total.should.equal(10000);
      for (i = 0, l = 10;i < l;++i)
        bins[i].should.equal(0);
      for (i = 10, l = 91;i < l;++i)
        bins[i].should.be.above(0, "bin " + i + " was zero, should be above zero");
      for (i = 91, l = 100;i < l;++i)
        bins[i].should.equal(0);
    });

  it('10000 wake test with ignoreBudgetConstraint,  integer: this.askPrice(50) should return every number between this.minPrice and this.maxPrice inclusive',
    function () {
      let zi = new ZIAgent({
        integer: true,
        ignoreBudgetConstraint: true,
        minPrice: 10,
        maxPrice: 90,
        inventory: { money: 0, X: 0 },
        costs: { X: [80] },
        markets: [{ 'goods': 'X' }]
      });
      let i, l, total = 0;
      const bins = Array(100).fill(0);
      zi.ask = function (market, p) {
        Math.floor(p).should.equal(p);
        bins[p]++;
        total++;
      };
      for (i = 0, l = 10000;i < l;++i) {
        zi.wake();
      }
      total.should.equal(10000);
      for (i = 0, l = 10;i < l;++i)
        bins[i].should.equal(0);
      for (i = 10, l = 91;i < l;++i)
        bins[i].should.be.above(0, "bin " + i + " was zero, should be above zero");
      for (i = 91, l = 100;i < l;++i)
        bins[i].should.equal(0);
    });

  it('this.bidPrice and this.askPrice return undefined if input value is undefined, irregardless of integer or ignoreBudgetConstraint settings',
    function () {
      let flags = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1]
      ];
      flags.forEach(function (f) {
        let zi = new ZIAgent({ minPrice: 10, maxPrice: 90, ignoreBudgetConstraint: f[0], integer: f[1] });
        assert.ok(typeof(zi.bidPrice()) === 'undefined');
        assert.ok(typeof(zi.askPrice()) === 'undefined');
      });
    });


  it('integer this.bidPrice(v=100) chi-square test for uniformity on [0,100] inclusive with every bin hit', function () {
    let zi = new ZIAgent({ integer: true });
    testInclusiveUniformity({
      range: [0,100],
      f: ()=>(zi.bidPrice(100))
    });
  });

  it('integer this.askPrice(c=50) chi-square test for uniformity on [50,maxPrice=150] inclusive with every bin hit', function () {
    let zi = new ZIAgent({ integer: true, maxPrice: 150 });
    testInclusiveUniformity({
      range: [50,150],
      f: ()=>(zi.askPrice(50))
    });
  });
});

describe('new ZIJumpAgent', function(){
  let zijump;
  const emptyMarket = {
      currentBidPrice(){ return undefined; },
      currentAskPrice(){ return undefined; }
  };
  const activeMarket = {
    currentBidPrice(){ return 100; },
    currentAskPrice(){ return 200; }
  };
  before(function(){
    zijump = new ZIJumpAgent({minPrice: 1, maxPrice: 500});
  });
  it('should be a subclass of ZIAgent', function(){
    zijump.should.be.instanceOf(ZIAgent);
  });
  it('should throw an error if market.currentBidPrice not-a-function',function(){
    const market = {
      currentAskPrice(){ return 101; }
    };
    function bad(){
      zijump.bidPrice(500, market);
    }
    bad.should.throw();
  });
  it('should throw an error if market.currentAskPrice not-a-function', function(){
    const market = {
      currentBidPrice(){ return 50; }
    };
    function bad(){
      zijump.askPrice(10,market);
    }
    bad.should.throw();
  });
  it('should bid uniformly on [L,v] like ZI in empty market', function(){
    const L = zijump.minPrice;
    zijump.integer = false;
    const v = 250;
    testInclusiveUniformity({
      range: [L,v-1],
      multiple: 10000,
      integer: false,
      f: ()=>(zijump.bidPrice(v, emptyMarket))
    });
    zijump.integer = true;
    testInclusiveUniformity({
      range: [L,v],
      multiple: 10000,
      f: ()=>(zijump.bidPrice(v, emptyMarket))
    });
  });
  it('should ask uniformly on [c,H] like ZI in empty market', function(){
    const H = zijump.maxPrice;
    const c = Math.ceil(H/4);
    zijump.integer = false;
    testInclusiveUniformity({
      range: [c,H-1],
      multiple: 10000,
      integer: false,
      f: ()=>(zijump.askPrice(c, emptyMarket))
    });
    zijump.integer = true;
    testInclusiveUniformity({
      range: [c,H],
      multiple: 10000,
      f: ()=>(zijump.askPrice(c,emptyMarket))
    });
  });
  it('should bid uniformly on [bid,v] in active market', function(){
    const bid = activeMarket.currentBidPrice();
    assert(bid!==zijump.minPrice);
    zijump.integer = false;
    const v = 250;
    testInclusiveUniformity({
      range: [bid,v-1],
      multiple: 10000,
      integer: false,
      f: ()=>(zijump.bidPrice(v, activeMarket))
    });
    zijump.integer = true;
    testInclusiveUniformity({
      range: [bid,v],
      multiple: 10000,
      f: ()=>(zijump.bidPrice(v, activeMarket))
    });
  });
  it('should ask uniformly on [c,ask] in active market', function(){
    const ask = activeMarket.currentAskPrice();
    const H = zijump.maxPrice;
    assert(ask!==H);
    const c = Math.ceil(H/4);
    zijump.integer = false;
    testInclusiveUniformity({
      range: [c,ask-1],
      multiple: 10000,
      integer: false,
      f: ()=>(zijump.askPrice(c, activeMarket))
    });
    zijump.integer = true;
    testInclusiveUniformity({
      range: [c,ask],
      multiple: 10000,
      f: ()=>(zijump.askPrice(c,activeMarket))
    });
  });
});

describe('new ZISpreadAgent', function(){
  let zispread;
  before(function(){
    zispread = new ZISpreadAgent({minPrice: 1, maxPrice: 500, integer:true});
  });
  it('should throw an error if market.currentBidPrice not-a-function',function(){
    const market = {
      currentAskPrice(){ return 101; }
    };
    function bad1(){
      zispread.bidPrice(500, market);
    }
    function bad2(){
      zispread.askPrice(1, market);
    }
    bad1.should.throw();
    bad2.should.throw();
  });
  it('should throw an error if market.currentAskPrice not-a-function', function(){
    const market = {
      currentBidPrice(){ return 50; }
    };
    function bad1(){
      zispread.bidPrice(500, market);
    }
    function bad2(){
      zispread.askPrice(1, market);
    }
    bad1.should.throw();
    bad2.should.throw();
  });
  const tests = [
    [['bidPrice',450,undefined,undefined],[1,450]],
    [['askPrice',50,undefined,undefined],[50,500]],
    [['bidPrice',400,100,undefined],[100,400]],
    [['askPrice',50,100,undefined],[100,500]],
    [['bidPrice',400,450,undefined],undefined],
    [['askPrice',50,20,undefined],[50,500]],
    [['bidPrice',400,undefined,250],[1,250]],
    [['askPrice',100,undefined,250],[100,250]],
    [['bidPrice',400,undefined,450],[1,400]],
    [['askPrice',100,undefined,50],undefined],
    [['bidPrice',400,100,300],[100,300]],
    [['askPrice',50,100,300],[100,300]],
    [['bidPrice',200,100,300],[100,200]],
    [['askPrice',200,100,300],[200,300]],
    [['bidPrice',50,100,300],undefined],
    [['askPrice',400,100,300],undefined]
  ];
  tests.forEach(([test,expected])=>{
    const [method,param,currentBid,currentAsk] = test;
    const market = {
      currentBidPrice(){return currentBid;},
      currentAskPrice(){return currentAsk;}
    };
    if (expected===undefined){
      it(`zispread.${method}(${param}) ${currentBid}x${currentAsk} -> undefined`, function(){
        assert.strictEqual(zispread[method](param,market),undefined);
      });
    } else {
      it(`zispread.${method}(${param}) ${currentBid}x${currentAsk} -> U${JSON.stringify(expected)}`, function(){
        testInclusiveUniformity({
          range: expected,
          multiple: 1000,
          f: ()=>(zispread[method](param,market))
        });
      });
    }
  });
});


describe('new UnitAgent', function () {

  it('should be a subclass of ZIAgent', function () {
    let myAgent = new UnitAgent();
    myAgent.should.be.instanceOf(ZIAgent);
  });

  it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
    function () {
      let myAgent = new UnitAgent();
      myAgent.should.be.type('object');
      myAgent.should.have.properties('id', 'description', 'inventory', 'wakeTime', 'rate', 'nextWake', 'period');
      myAgent.id.should.be.type('number');
      myAgent.description.should.be.type('string');
      myAgent.inventory.should.be.type('object');
      myAgent.wakeTime.should.be.type('number');
      myAgent.rate.should.be.type('number');
      myAgent.nextWake.should.be.type('function');
      myAgent.period.should.be.type('object');
    });

  it('should have properties markets, values, costs, minPrice, maxPrice with proper types', function () {
    let a = new UnitAgent();
    a.should.have.properties('markets', 'values', 'costs', 'minPrice', 'maxPrice');
    a.markets.should.be.type('object');
    a.values.should.be.type('object');
    a.costs.should.be.type('object');
    a.minPrice.should.be.type('number');
    a.maxPrice.should.be.type('number');
  });

  it('should not call this.bid() or this.ask() on this.wake() if values and costs not configured', function () {
    let a = new UnitAgent();
    let wakes = 0,
      bids = 0,
      asks = 0;
    a.on('wake', function () { wakes++; });
    a.bid = function () { bids++; };
    a.ask = function () { asks++; };
    a.wake();
    wakes.should.equal(1);
    bids.should.equal(0);
    asks.should.equal(0);
  });

  it('this.bidPrice and this.askPrice return undefined if input value is undefined, irregardless of integer or ignoreBudgetConstraint settings',
    function () {
      let flags = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1]
      ];
      flags.forEach(function (f) {
        let a = new UnitAgent({ minPrice: 10, maxPrice: 90, ignoreBudgetConstraint: f[0], integer: f[1] });
        assert.ok(typeof(a.bidPrice()) === 'undefined');
        assert.ok(typeof(a.askPrice()) === 'undefined');
      });
    });

  it('this.bidPrice and this.askPrice should throw on valid input if market.lastTradePrice function does not exist', function () {
    function callBidPriceWithNoGetPreviousPrice() {
      let a = new UnitAgent({ minPrice: 10, maxPrice: 90 });
      a.bidPrice(50);
    }

    function callAskPriceWithNoGetPreviousPrice() {
      let a = new UnitAgent({ minPrice: 10, maxPrice: 90 });
      a.askPrice(60);
    }
    callBidPriceWithNoGetPreviousPrice.should.throw();
    callAskPriceWithNoGetPreviousPrice.should.throw();
  });

  it('this.bidPrice(50) is between 1 and 50 inclusive if market.lastTradePrice() is undefined', function(){
    let a = new UnitAgent({minPrice:1, maxPrice:100, integer: true});
    const market = {
      lastTradePrice(){ return undefined; }
    };
    for(let i=0;i<1000;++i)
      a.bidPrice(50, market).should.be.within(1,50);
  });

  it('this.askPrice(50) is between 50 and 100 inclusive if market.lastTradePrice() is undefined', function(){
    let a = new UnitAgent({minPrice:1, maxPrice:100, integer: true});
    const market = {
      lastTradePrice(){ return undefined; }
    };
    for(let i=0;i<1000;++i)
      a.askPrice(50, market).should.be.within(50,100);
  });

  it('this.bidPrice(50) is undefined if market.lastTradePrice()===51.01', function () {
    let a = new UnitAgent({ minPrice: 10, maxPrice: 90 });
    let market = {
      lastTradePrice() { return 51.01; }
    };
    let i, l, p;
    for (i = 0, l = 100;i < l;++i) {
      p = a.bidPrice(50, market);
      assert(typeof(p) === 'undefined', p);
    }
    a.integer = true;
    for (i = 0, l = 100;i < l;++i) {
      p = a.bidPrice(50, market);
      assert(typeof(p) === 'undefined', p);
    }
  });

  it('this.bidPrice(50) is 32,33,34 approx 1/3 of time if .integer===true, market.lastTradePrice()===33', function () {
    let a = new UnitAgent({ minPrice: 10, maxPrice: 90, integer: true });
    let market = {};
    market.lastTradePrice = function () { return 33; };
    testInclusiveUniformity({
      range: [32,34],
      multiple: 10000,
      f: ()=>(a.bidPrice(50,market))
    });
  });

  it('this.bidPrice(50) is 32-33, 33-34 approx 1/2 of time if .integer===false, market.lastTradePrice()===33', function () {
    let a = new UnitAgent({ minPrice: 10, maxPrice: 90 });
    let market = { lastTradePrice() { return 33; } };
    testInclusiveUniformity({
      range: [32,33],
      integer: false,
      multiple: 10000,
      f: ()=>(a.bidPrice(50, market))
    });
  });

  it('this.bidPrice(33) is 32-33, undefined approx 1/2 of time if .integer===false, market.lastTradePrice()===33', function () {
    let a = new UnitAgent({ minPrice: 10, maxPrice: 90 });
    let market = { lastTradePrice() { return 33; } };
    let i, l, p, un = 0;
    let bin = Array(100).fill(0);
    for (i = 0, l = 20000;i < l;++i) {
      p = a.bidPrice(33, market);
      if (p)
        bin[Math.floor(p)]++;
      else
        un++;
    }
    un.should.be.within(9500, 10500);
    bin[31].should.equal(0);
    bin[32].should.be.within(9500, 10500);
    bin[33].should.equal(0);
    bin[34].should.equal(0);
    bin[35].should.equal(0);
  });

  it('this.askPrice(50) is undefined if market.lastTradePrice()===48.99', function () {
    let a = new UnitAgent({ minPrice: 10, maxPrice: 90 });
    let market = { lastTradePrice() { return 48.99; } };
    let i, l, p;
    for (i = 0, l = 100;i < l;++i) {
      p = a.askPrice(50, market);
      assert(typeof(p) === 'undefined', p);
    }
    a.integer = true;
    for (i = 0, l = 100;i < l;++i) {
      p = a.askPrice(50, market);
      assert(typeof(p) === 'undefined', p);
    }
  });

  it('this.askPrice(25) is 32,33,34 approx 1/3 of time if ,integer===true, market.lastTradePrice()===33', function () {
    let a = new UnitAgent({ minPrice: 10, maxPrice: 90, integer: true });
    let market = { lastTradePrice() { return 33; } };
    testInclusiveUniformity({
      range: [32,34],
      multiple: 10000,
      f: ()=>(a.askPrice(25,market))
    });
  });

  it('this.askPrice(25) is 32-33, 33-34 approx 1/2 of time if ,integer===false, market.lastTradePrice()===33', function () {
    let a = new UnitAgent({ minPrice: 10, maxPrice: 90 });
    let market = { lastTradePrice() { return 33; } };
    testInclusiveUniformity({
      range: [32,33],
      multiple: 10000,
      integer: false,
      f: ()=>(a.askPrice(25,market))
    });
  });
});

describe('new TTAgent', function () {

  it('should be a subclass of ZIAgent', function () {
    let myAgent = new TTAgent();
    myAgent.should.be.instanceOf(ZIAgent);
  });

  it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
    function () {
      let myAgent = new TTAgent();
      myAgent.should.be.type('object');
      myAgent.should.have.properties('id', 'description', 'inventory', 'wakeTime', 'rate', 'nextWake', 'period');
      myAgent.id.should.be.type('number');
      myAgent.description.should.be.type('string');
      myAgent.inventory.should.be.type('object');
      myAgent.wakeTime.should.be.type('number');
      myAgent.rate.should.be.type('number');
      myAgent.nextWake.should.be.type('function');
      myAgent.period.should.be.type('object');
    });

  it('should have properties markets, values, costs, minPrice, maxPrice with proper types', function () {
    let a = new TTAgent();
    a.should.have.properties('markets', 'values', 'costs', 'minPrice', 'maxPrice');
    a.markets.should.be.type('object');
    a.values.should.be.type('object');
    a.costs.should.be.type('object');
    a.minPrice.should.be.type('number');
    a.maxPrice.should.be.type('number');
  });

  it('should not call this.bid() or this.ask() on this.wake() if values and costs not configured', function () {
    let a = new TTAgent();
    let wakes = 0,
      bids = 0,
      asks = 0;
    a.on('wake', function () { wakes++; });
    a.bid = function () { bids++; };
    a.ask = function () { asks++; };
    a.wake();
    wakes.should.equal(1);
    bids.should.equal(0);
    asks.should.equal(0);
  });

  it('this.bidPrice(50) is between 1 and 50 inclusive if no currentBid/currentAsk', function(){
    let a = new TTAgent({minPrice:1, maxPrice:100, integer: true});
    const market = {
      currentBidPrice(){},  // eslint-disable-line no-empty-function
      currentAskPrice(){}   // eslint-disable-line no-empty-function
    };
    for(let i=0;i<1000;++i)
      a.bidPrice(50, market).should.be.within(1,50);
  });

  it('this.askPrice(50) is between 50 and 100 inclusive if no currentBid/currentAsk', function(){
    let a = new TTAgent({minPrice:1, maxPrice:100, integer: true});
    const market = {
      currentBidPrice(){},  // eslint-disable-line no-empty-function
      currentAskPrice(){}   // eslint-disable-line no-empty-function
    };
    for(let i=0;i<1000;++i)
      a.askPrice(50, market).should.be.within(50,100);
  });

  it('specifying currentBid,currentAsk will produce bids/asks consistent with optimizing over flat prior', function(){
    let a = new TTAgent({minPrice:1,maxPrice:1000, integer:true});
    a.tts.newPeriod();
    const market = {
      currentBidPrice(){ return 200;},
      currentAskPrice(){ return 300;}
    };
    for(let i=1;i<100;++i){
      a.bidPrice(i,market).should.be.within(1,i); // fallback to ZI
      a.askPrice(i,market).should.equal(200);
    }
    for(let i=100;i<200;i+=2){
      a.bidPrice(i,market).should.be.within(1,i);
      const profitFromAcceptingBid = 200-i;
      const optimalAsk = (i+300)/2;
      const probAskAccepted = (300-optimalAsk)/101; // 101 because 101 values including bid of 200 and ask of 300
      const eProfitNewAsk = (optimalAsk-i)*probAskAccepted;
      const expected = (profitFromAcceptingBid>=Math.floor(eProfitNewAsk))? 200: optimalAsk;
      a.askPrice(i,market).should.equal(expected);
    }
    // 200 has zero profit for buyer, so reverts to zi
    a.bidPrice(200,market).should.be.within(1,200);
    for(let i=202;i<300;i+=2){
      a.bidPrice(i,market).should.equal((i+200)/2);
      a.askPrice(i,market).should.equal((i+300)/2);
    }
    for(let i=300;i<374;i+=2){
      a.bidPrice(i,market).should.equal((i+200)/2);
      a.askPrice(i,market).should.be.within(i,1000);
    }
    for(let i=374;i<400;i+=2){
      a.bidPrice(i,market).should.equal(300);
      a.askPrice(i,market).should.be.within(i,1000);
    }
    for(let i=400;i<1000;++i){
      a.bidPrice(i,market).should.equal(300);
      a.askPrice(i,market).should.be.within(i,1000);
    }
  });

});

describe('new OneupmanshipAgent', function () {
  const common = {
    minPrice: 1,
    maxPrice: 100
  };
  it('should bid minPrice if no currentBid', function () {
    const market = {
      currentBidPrice() { return undefined; }
    };
    (new OneupmanshipAgent(common)
      .bidPrice(40, market)
      .should.equal(common.minPrice));
  });
  it('should bid 31 if the current bid is 30 and the MV is 40', function () {
    const market = {
      currentBidPrice() { return 30; }
    };
    (new OneupmanshipAgent(common)
      .bidPrice(40, market)
      .should.equal(31));
  });
  it('should not bid if the current bid is 50 and the MV is 40', function () {
    const market = {
      currentBidPrice() { return 50; }
    };
    assert.ok(new OneupmanshipAgent(common).bidPrice(40, market) === undefined);
  });
  it('should ask maxPrice if no currentAsk', function () {
    const market = {
      currentAskPrice() { return undefined; }
    };
    (new OneupmanshipAgent(common)
      .askPrice(77, market)
      .should.equal(common.maxPrice));
  });
  it('should ask 79 if the current ask is 80 and the MC is 77', function () {
    const market = {
      currentAskPrice() { return 80; }
    };
    (new OneupmanshipAgent(common)
      .askPrice(77, market)
      .should.equal(79));
  });
  it('should not ask if the current ask is 77 and the MC is 77', function () {
    const market = {
      currentAskPrice() { return 77; }
    };
    assert.ok(new OneupmanshipAgent(common).askPrice(77, market) === undefined);
  });
});

describe('new MidpointAgent', function () {
  const common = {
    minPrice: 1,
    maxPrice: 100,
    integer: true
  };
  it('should bid minPrice if no currentBid', function () {
    const market = {
      currentBidPrice() { return undefined; }
    };
    (new MidpointAgent(common)
      .bidPrice(40, market)
      .should.equal(common.minPrice));
  });
  it('should bid 33 if the current bid is 30, current ask is 35 and the MV is 40', function () {
    const market = {
      currentBidPrice() { return 30; },
      currentAskPrice() { return 35; }
    };
    (new MidpointAgent(common)
      .bidPrice(40, market)
      .should.equal(33));
  });
  it('should not bid if the current bid is 50 and current ask is 60 but the MV is 40', function () {
    const market = {
      currentBidPrice() { return 50; },
      currentAskPrice() { return 60; }
    };
    assert.ok(new MidpointAgent(common).bidPrice(40, market) === undefined);
  });
  it('should ask maxPrice if no currentAsk', function () {
    const market = {
      currentBidPrice() { return 10; },
      currentAskPrice() { return undefined; }
    };
    (new MidpointAgent(common)
      .askPrice(77, market)
      .should.equal(common.maxPrice));
  });
  it('should ask 78 if the current ask is 80, current bid is 76 and the MC is 77', function () {
    const market = {
      currentAskPrice() { return 80; },
      currentBidPrice() { return 76; }
    };
    (new MidpointAgent(common)
      .askPrice(77, market)
      .should.equal(78));
  });
  it('should not ask if the current ask is 77, current bid is 76,  and the MC is 77', function () {
    const market = {
      currentAskPrice() { return 77; },
      currentBidPrice() { return 76; }
    };
    assert.ok(new MidpointAgent(common).askPrice(77, market) === undefined);
  });
});

describe('new DoNothingAgent', function(){
    const testvalues = [10,20,30,50,50,100,129,198,999,-50];
    it('should not bid', function(){
	assert.ok(new DoNothingAgent().bidPrice()===undefined);
	testvalues.forEach((v)=>(assert.ok((new DoNothingAgent().bidPrice(v))===undefined)));
    });
    it('should not ask', function(){
	assert.ok(new DoNothingAgent().askPrice()===undefined);
	testvalues.forEach((v)=>(assert.ok((new DoNothingAgent().askPrice(v))===undefined)));
    });
});

describe('new TruthfulAgent', function () {
  it('should not bid if marginalValue is undefined', function () {
    const bid = new TruthfulAgent().bidPrice(undefined);
    assert.ok(typeof(bid) === 'undefined');
  });
  it('should bid 30 if marginalValue is 30', function () {
    new TruthfulAgent().bidPrice(30).should.equal(30);
  });
  it('should bid 40 if marginalValue is 40', function () {
    new TruthfulAgent().bidPrice(40).should.equal(40);
  });
  it('should bid 50 if marginalValue is 50', function () {
    new TruthfulAgent().bidPrice(50).should.equal(50);
  });
  it('should bid 44.5 if marginalValue is 44.5 and integer is false', function () {
    new TruthfulAgent({ integer: false }).bidPrice(44.5).should.equal(44.5);
  });
  it('should bid 44 if marginalValue is 44.5 and integer is true', function () {
    new TruthfulAgent({ integer: true }).bidPrice(44.5).should.equal(44);
  });
  it('should ask 30 if marginalCost is 30', function () {
    new TruthfulAgent().askPrice(30).should.equal(30);
  });
  it('should ask 40 if marginalCost is 40', function () {
    new TruthfulAgent().askPrice(40).should.equal(40);
  });
  it('should ask 50 if marginalCost is 50', function () {
    new TruthfulAgent().askPrice(50).should.equal(50);
  });
  it('should ask 56 if marginalCost is 55.25 and integer is true', function () {
    new TruthfulAgent({ integer: true }).askPrice(55.25).should.equal(56);
  });
  it('should ask 55.25 if marginalCost is 55.25 and integer is false', function () {
    new TruthfulAgent({ integer: false }).askPrice(55.25).should.equal(55.25);
  });
});

describe('new DPPAgent', function(){
  it('should bid 10 if marginalValue is 10000, minPrice is 1, 25% of period is used, and integer is true', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:1000000,
      period: {startTime:1000,endTime:2000},
      integer: true
    });
    a.wakeTime = 1250;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.bidPrice(10000).should.equal(10);
  });
  it('should bid approx. 10 if marginalValue is 10000, minPrice is 1, 25% of period is used, and integer is false', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:1000000,
      period: {startTime:1000,endTime:2000},
      integer: false
    });
    a.wakeTime = 1250;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.bidPrice(10000).should.be.approximately(10,0.001);
  });
  it('should bid 100 if marginalValue is 10000, minPrice is 1, 50% of period is used, and integer is true', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:1000000,
      period: {startTime:1000,endTime:2000},
      integer: true
    });
    a.wakeTime = 1500;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.bidPrice(10000).should.equal(100);
  });
  it('should bid approx. 100 if marginalValue is 10000, minPrice is 1, 50% of period is used, and integer is false', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:1000000,
      period: {startTime:1000,endTime:2000},
      integer: false
    });
    a.wakeTime = 1500;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.bidPrice(10000).should.be.approximately(100,0.001);
  });
  it('should bid 1000 if marginalValue is 10000, minPrice is 1, 75% of period is used, and integer is true', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:1000000,
      period: {startTime:1000,endTime:2000},
      integer: true
    });
    a.wakeTime = 1750;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.bidPrice(10000).should.equal(1000);
  });
  it('should bid approx. 1000 if marginalValue is 10000, minPrice is 1, 75% of period is used, and integer is false', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:1000000,
      period: {startTime:1000,endTime:2000},
      integer: false
    });
    a.wakeTime = 1750;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.bidPrice(10000).should.be.approximately(1000,0.001);
  });
  it('should ask 1000 if marginalCost is 1, maxPrice is 10000, 25% of period is used, and integer is true', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:10000,
      period: {startTime:1000,endTime:2000},
      integer: true
    });
    a.wakeTime = 1250;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.askPrice(1).should.equal(1000);
  });
  it('should ask approx. 1000 if marginalCost is 1, maxPrice is 10000, 25% of period is used, and integer is false', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:10000,
      period: {startTime:1000,endTime:2000},
      integer: false
    });
    a.wakeTime = 1250;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.askPrice(1).should.be.approximately(1000,0.001);
  });
  it('should ask 100 if marginalCost is 1, maxPrice is 10000, 50% of period is used, and integer is true', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:10000,
      period: {startTime:1000,endTime:2000},
      integer: true
    });
    a.wakeTime = 1500;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.askPrice(1).should.equal(100);
  });
  it('should ask approx. 100 if marginalCost is 1, maxPrice is 10000, 50% of period is used, and integer is false', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:10000,
      period: {startTime:1000,endTime:2000},
      integer: false
    });
    a.wakeTime = 1500;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.askPrice(1).should.be.approximately(100,0.001);
  });
  it('should ask 10 if marginalCost is 1, maxPrice is 10000, 75% of period is used, and integer is true', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:10000,
      period: {startTime:1000,endTime:2000},
      integer: true
    });
    a.wakeTime = 1750;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.askPrice(1).should.equal(10);
  });
  it('should ask approx. 10 if marginalCost is 1, maxPrice is 10000, 75% of period is used, and integer is false', function(){
    const a = new DPPAgent({
      minPrice:1,
      maxPrice:10000,
      period: {startTime:1000,endTime:2000},
      integer: false
    });
    a.wakeTime = 1750;  // must set here -- would be overridden by nextWake() if set in the constructor
    a.askPrice(1).should.be.approximately(10,0.001);
  });
});

describe('new HoarderAgent', function () {
  it('should not bid if currentAskPrice is undefined', function () {
    const bid = (new HoarderAgent()
      .bidPrice(100, { currentAskPrice: (() => undefined) })
    );
    assert.ok(typeof(bid) === 'undefined');
  });
  it('should bid 75 if market.currentAskPrice is 75 even if marginalValue is 50', function () {
    const bid = (new HoarderAgent()
      .bidPrice(50, { currentAskPrice: (() => 75) })
    );
    bid.should.equal(75);
  });
  it('should return undefined for ask', function () {
    const ask = (new HoarderAgent()
      .askPrice(20));
    assert.ok(typeof(ask) === 'undefined');
  });
});

describe('new Sniper', function(){
  // Sniper is meant to be an Abstract Class so should not normally be instantiated
  it('should have properties buyOnCloseTime, sellOnCloseTime equal to zero', function(){
    let a = new MarketAgents.Sniper({});
    a.should.have.properties({
      buyOnCloseTime: 0,
      sellOnCloseTime: 0
    });
   });
   it('.buyNow throws /abstract/', function(){
     let a = new MarketAgents.Sniper({});
     a.buyNow.should.throw(/abstract/);
   });
   it('.sellNow throws /abstract/', function(){
     let a = new MarketAgents.Sniper({});
     a.sellNow.should.throw(/abstract/);
   });
});

function testSniperAgent({
    SniperType,
    agentConfig={},
    marketInfo,
    call,
    param,
    correctValue
}){
  const a = new SniperType(agentConfig);
  const message = "config: " + JSON.stringify(agentConfig) + "\n" +
    "info: " + JSON.stringify(marketInfo) + "\n" +
    "call: " + call + "\n" +
    "param: " + param + "\n" +
    "correct: " + correctValue;
  const market = {
    currentBidPrice() { return marketInfo.currentBidPrice; },
    currentAskPrice() { return marketInfo.currentAskPrice; },
    lastTradePrice() { return marketInfo.lastTradePrice; },
    previousPeriod(prop) {
      return (marketInfo.previousPeriod && marketInfo.previousPeriod[prop]);
    }
  };
  if (correctValue === undefined)
    assert.strictEqual(typeof(a[call](param, market)), "undefined", message);
  else
    assert.strictEqual(a[call](param, market), correctValue, message);
}

function generalSniperTests(SniperType){
  it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
    function () {
      let myAgent = new SniperType();
      myAgent.should.be.type('object');
      myAgent.should.have.properties('id', 'description', 'inventory', 'wakeTime', 'rate', 'nextWake', 'period');
      myAgent.id.should.be.type('number');
      myAgent.description.should.be.type('string');
      myAgent.inventory.should.be.type('object');
      myAgent.wakeTime.should.be.type('number');
      myAgent.rate.should.be.type('number');
      myAgent.nextWake.should.be.type('function');
      myAgent.period.should.be.type('object');
    });

  it('should have properties markets, values, costs, minPrice, maxPrice with proper types', function () {
    let a = new SniperType();
    a.should.have.properties('markets', 'values', 'costs', 'minPrice', 'maxPrice');
    a.markets.should.be.type('object');
    a.values.should.be.type('object');
    a.costs.should.be.type('object');
    a.minPrice.should.be.type('number');
    a.maxPrice.should.be.type('number');
  });

  it('should not call this.bid() or this.ask() on this.wake() if values and costs not configured', function () {
    let a = new SniperType();
    let wakes = 0,
      bids = 0,
      asks = 0;
    a.on('wake', function () { wakes++; });
    a.bid = function () { bids++; };
    a.ask = function () { asks++; };
    a.wake();
    wakes.should.equal(1);
    bids.should.equal(0);
    asks.should.equal(0);
  });

  it('this.bidPrice and this.askPrice return undefined if input value is undefined, irregardless of integer setting',
    function () {
      let flags = [0, 1];
      flags.forEach(function (f) {
        let a = new SniperType({ minPrice: 10, maxPrice: 90, integer: f });
        assert.ok(typeof(a.bidPrice()) === 'undefined');
        assert.ok(typeof(a.askPrice()) === 'undefined');
      });
    });

  it('this.bidPrice and this.askPrice should throw on valid input if special getter functions do not exist', function () {
    function callBidPriceWithNoGetters() {
      let a = new SniperType({ minPrice: 10, maxPrice: 90 });
      a.bidPrice(50);
    }

    function callAskPriceWithNoGetters() {
      let a = new SniperType({ minPrice: 10, maxPrice: 90 });
      a.askPrice(60);
    }
    callBidPriceWithNoGetters.should.throw();
    callAskPriceWithNoGetters.should.throw();
  });

  it('.bidPrice is undefined if currentAsk undefined', function () {
    for (let i = 1, l = 100;i < l;++i)
      testSniperAgent({
        SniperType,
        marketInfo: {
            currentBidPrice: 10,
            lastTradePrice: 51,
            previousPeriod: {
              lowPrice: 40,
              medianPrice: 50,
              highPrice: 60
            }
        },
        call: "bidPrice",
        param: i,
        correctValue: undefined
      });
  });

  it('.askPrice is undefined if currentBid undefined', function () {
    for (let i = 1, l = 100;i < l;++i)
      testSniperAgent({
        SniperType,
        marketInfo: {
            currentAskPrice: 70,
            lastTradePrice: 51,
            previousPeriod: {
              lowPrice: 40,
              medianPrice: 50,
              highPrice: 60
            }
        },
        call: "askPrice",
        param: i,
        correctValue: undefined
      });
  });

}

describe('new KaplanSniperAgent', function () {
  generalSniperTests(KaplanSniperAgent);

  it('.bidPrice(MV) equals currentAsk===50 iff 50<=juicyAskPrice and 50<=MV', function () {
    let shouldBe50;
    for (let marginalValue = 1;marginalValue < 100;++marginalValue)
      for (let juicyAskPrice = 1;juicyAskPrice < 100;++juicyAskPrice) {
        shouldBe50 = (50 <= juicyAskPrice) && (50 <= marginalValue); // eslint-disable-line yoda
        testSniperAgent({
            SniperType: KaplanSniperAgent,
            marketInfo: {
              currentAskPrice: 50,
              previousPeriod: {
                lowPrice: juicyAskPrice
              }
            },
            call: "bidPrice",
            param: marginalValue,
            correctValue: (shouldBe50 ? 50 : undefined)
          });
      }
  });

  it(".bidPrice(MV) equals currentAsk===50 iff spread <= desiredSpread and 50<=MV", function () {
    let cBid, dSpread, MV;
    for (cBid = 1;cBid < 50;cBid++)
      for (dSpread = 1;dSpread < 40;dSpread++)
        for (MV = 40;MV < 60;MV++)
          testSniperAgent({
            SniperType: KaplanSniperAgent,
            agentConfig:{
              desiredSpread: dSpread
            },
            marketInfo: {
              currentBidPrice: cBid,
              currentAskPrice: 50
            },
            call: "bidPrice",
            param: MV,
            correctValue: (((MV >= 50) && ((50 - cBid) <= dSpread)) ? 50 : undefined)
          });
  });

  it('.askPrice(MC) equals currentBid===60 iff juicyBidPrice<=60 and MC<=60', function () {
    let shouldBe60;
    for (let marginalCost = 1;marginalCost < 100;++marginalCost)
      for (let juicyBidPrice = 1;juicyBidPrice < 100;++juicyBidPrice) {
        shouldBe60 = (juicyBidPrice <= 60) && (marginalCost <= 60);
        testSniperAgent({
          SniperType: KaplanSniperAgent,
          marketInfo: {
            currentBidPrice: 60,
            previousPeriod: {
              highPrice: juicyBidPrice
            }
          },
          call: "askPrice",
          param: marginalCost,
          correctValue: (shouldBe60 ? 60 : undefined)
        });
      }
  });

  it('.askPrice(MC) equals currentBid iff spread <= desiredSpread and MC<= currentBid', function () {
    for (let currentBid = 55;currentBid < 65;currentBid++)
      for (let currentAsk = currentBid + 1;currentAsk < (currentBid + 30);currentAsk++)
        for (let desiredSpread = 1;desiredSpread < 15;desiredSpread++)
          for (let mc = 50;mc < 70;mc++)
            testSniperAgent({
              SniperType: KaplanSniperAgent,
              agentConfig: {
                desiredSpread
              },
              marketInfo: {
                  currentBidPrice: currentBid,
                  currentAskPrice: currentAsk,
                  previousPeriod: {
                    highPrice: 200,
                    lowPrice: 10
                  }
              },
              call: "askPrice",
              param: mc,
              correctValue: (((mc <= currentBid) && ((currentAsk - currentBid) <= desiredSpread)) ? currentBid : undefined)
            });
  });
});

describe('new MedianSniperAgent', function () {
  generalSniperTests(MedianSniperAgent);

  it('.bidPrice(MV) equals currentAsk===50 iff 50<=previousMedian and 50<=MV', function () {
    let shouldBe50;
    for (let marginalValue = 1;marginalValue < 100;++marginalValue)
      for (let previousMedian = 1;previousMedian < 100;++previousMedian) {
        shouldBe50 = (50 <= previousMedian) && (50 <= marginalValue); // eslint-disable-line yoda
        testSniperAgent({
          SniperType: MedianSniperAgent,
          marketInfo: {
              currentAskPrice: 50,
              previousPeriod: { medianPrice: previousMedian }
          },
          call: "bidPrice",
          param: marginalValue,
          correctValue: (shouldBe50 ? 50 : undefined)
        });
      }
  });

  it('.askPrice(MC) equals currentBid===60 iff previousMedian<=60 and MC<=60', function () {
    let shouldBe60;
    for (let marginalCost = 1;marginalCost < 100;++marginalCost)
      for (let previousMedian = 1;previousMedian < 100;++previousMedian) {
        shouldBe60 = (previousMedian <= 60) && (marginalCost <= 60);
        testSniperAgent({
          SniperType: MedianSniperAgent,
          marketInfo: {
              currentBidPrice: 60,
              previousPeriod: { medianPrice: previousMedian }
          },
          call: "askPrice",
          param: marginalCost,
          correctValue: (shouldBe60 ? 60 : undefined)
        });
      }
  });
});

function noNegativeProfitSniperTest(SniperType){
  it('should not accept a bid that is below MC', function(){
    for(let marginalCost=21;marginalCost<100;marginalCost++){
      testSniperAgent({
        SniperType,
        marketInfo: {
          currentBidPrice: 20,
          currentAskPrice: 80,
          lastTradePrice: 55
        },
        call: "askPrice",
        param: marginalCost,
        correctValue: undefined
      });
      testSniperAgent({
        SniperType,
        marketInfo: {
          lastTradePrice: 10,
          currentBidPrice: 15,
          currentAskPrice: 90
        },
        call: "askPrice",
        param: marginalCost,
        correctValue: undefined
      });
    }
  });
  it('should not accept an ask that is above MV', function(){
    for(let marginalValue=1;marginalValue<70;marginalValue++){
      testSniperAgent({
        SniperType,
        marketInfo: {
          currentBidPrice: 70,
          currentAskPrice: 80,
          lastTradePrice: 75
        },
        call: "bidPrice",
        param: marginalValue,
        correctValue: undefined
      });
      testSniperAgent({
        SniperType,
        marketInfo: {
          lastTradePrice: 80,
          currentBidPrice: 70,
          currentAskPrice: 71
        },
        call: "bidPrice",
        param: marginalValue,
        correctValue: undefined
      });
    }
  });
}

describe('new AcceptSniperAgent', function(){
  generalSniperTests(AcceptSniperAgent);
  noNegativeProfitSniperTest(AcceptSniperAgent);
  it('should accept an ask that is below marginal value', function(){
    for(let marginalValue=61;marginalValue<100;marginalValue++)
      testSniperAgent({
        SniperType: AcceptSniperAgent,
        marketInfo: {
          currentBidPrice: 40,
          currentAskPrice: 60
        },
        call: "bidPrice",
        param: marginalValue,
        correctValue: 60
      });
  });
  it('should accept a bid that is above marginal cost', function(){
    for(let marginalCost=1;marginalCost<40;marginalCost++)
      testSniperAgent({
        SniperType: AcceptSniperAgent,
        marketInfo: {
          currentBidPrice: 40,
          currentAskPrice: 60
        },
        call: "askPrice",
        param: marginalCost,
        correctValue: 40
      });
    });
});

describe('new RandomAcceptSniperAgent', function(){
  generalSniperTests(RandomAcceptSniperAgent);
  noNegativeProfitSniperTest(RandomAcceptSniperAgent);
  // could be useful: additional testing regarding the random acceptance distribution
});

describe('new FallingAskSniperAgent', function(){
  generalSniperTests(FallingAskSniperAgent);
  noNegativeProfitSniperTest(FallingAskSniperAgent);
  it('should accept the current bid when currentAskPrice<lastTradePrice and MC<=currentBidPrice', function(){
    for(let marginalCost=1;marginalCost<50;marginalCost++)
      for(let lastTradePrice=30;lastTradePrice<70;lastTradePrice++){
        const shouldAsk = (lastTradePrice>60) && (marginalCost<=40);
        testSniperAgent({
          SniperType: FallingAskSniperAgent,
          marketInfo: {
            lastTradePrice,
            currentBidPrice: 40,
            currentAskPrice: 60
          },
          call: "askPrice",
          param: marginalCost,
          correctValue: (shouldAsk? 40: undefined)
        });
      }
  });
  it('should accept the current ask price when currentAskPrice<lastTradePrice and MV>=currentAskPrice', function(){
    for(let marginalValue=50;marginalValue<100;marginalValue++)
      for(let lastTradePrice=30;lastTradePrice<70;lastTradePrice++){
        const shouldBid = (lastTradePrice>60) && (marginalValue>=60);
        testSniperAgent({
          SniperType: FallingAskSniperAgent,
          marketInfo: {
            lastTradePrice,
            currentBidPrice: 40,
            currentAskPrice: 60
          },
          call: "bidPrice",
          param: marginalValue,
          correctValue: (shouldBid? 60: undefined)
        });
      }
    });
});

describe('new RisingBidSniperAgent', function(){
  generalSniperTests(RisingBidSniperAgent);
  noNegativeProfitSniperTest(RisingBidSniperAgent);
  it('should accept the current bid price when lastTradePrice<currentBidPrice and MC<=currentBidPrice', function(){
    for(let marginalCost=1;marginalCost<50;marginalCost++)
      for(let lastTradePrice=30;lastTradePrice<70;lastTradePrice++){
        const shouldAsk = (lastTradePrice<40) && (marginalCost<=40);
        testSniperAgent({
          SniperType: RisingBidSniperAgent,
          marketInfo: {
            lastTradePrice,
            currentBidPrice: 40,
            currentAskPrice: 60
          },
          call: "askPrice",
          param: marginalCost,
          correctValue: (shouldAsk? 40: undefined)
        });
      }
  });
  it('should accept the current ask price when lastTradePrice<currentBidPrice and MV>=currentAskPrice', function(){
    for(let marginalValue=50;marginalValue<100;marginalValue++)
      for(let lastTradePrice=30;lastTradePrice<70;lastTradePrice++){
        const shouldBid = (lastTradePrice<40) && (marginalValue>=60);
        testSniperAgent({
          SniperType: RisingBidSniperAgent,
          marketInfo: {
            lastTradePrice,
            currentBidPrice: 40,
            currentAskPrice: 60
          },
          call: "bidPrice",
          param: marginalValue,
          correctValue: (shouldBid? 60: undefined)
        });
      }
    });
});

describe('new Pool', function () {
  it('new Pool() initially has no agents', function () {
    let myPool = new Pool();
    myPool.agents.should.deepEqual([]);
  });

  it('pool with no agents, .syncRun returns normally, no error', function () {
    let myPool = new Pool();
    myPool.syncRun(1000);
  });

  it('pool with no agents, .runAsPromise(1000) calls resolve normally, no error', function (done) {
    let myPool = new Pool();
    (myPool
      .runAsPromise(1000)
      .then((() => done()), ((e) => assert.ok(false, e)))
    );
  });

  it('pool with no agents, .endTime() is undefined', function(){
    let pool = new Pool();
    assert.strictEqual(typeof(pool.endTime()),"undefined");
  });

  it('should not accept invalid agents:  pool.push(a) should throw an error if a is not Agent-related', function () {
    let myPool = new Pool();

    function doNotDoThis() {
      myPool.push({});
    }
    doNotDoThis.should.throw();
  });

  it('pool.push should not accept duplicate agents, throws /conflict/', function(){
    const pool = new Pool();
    const a = new Agent();
    pool.push(a);
    function bad(){
      pool.push(a);
    }
    bad.should.throw(/conflict/);
  });

  it('pool.agentsById has entry for each id from pool.agents', function () {
    let pool = new Pool();
    let i, l;
    for (i = 0, l = 10;i < l;i++)
      pool.push(new Agent());
    pool.agents.length.should.equal(10);
    pool.agents.forEach(function (A) {
      assert.ok(pool.agentsById[A.id] === A);
    });
  });

  it('pool.initPeriod with 2 agents in pool calls .initPeriod on each agent', function () {
    let myPool = new Pool();
    let agent0 = new Agent();
    let agent1 = new Agent();
    agent0.period.number.should.equal(0);
    agent1.period.number.should.equal(0);
    myPool.push(agent0);
    myPool.push(agent1);
    myPool.agents[0].period.number.should.equal(0);
    myPool.agents[1].period.number.should.equal(0);
    myPool.initPeriod({ number: 1234, startTime: 10000 });
    myPool.agents[0].period.number.should.equal(1234);
    myPool.agents[1].period.number.should.equal(1234);
  });

  it('pool.initPeriod({number:5, startTime:50000}) sets all period numbers to 5, all wakeTime>50000', function () {
    let myPool = new Pool();
    let agent0 = new Agent();
    let agent1 = new Agent();
    agent0.period.number.should.equal(0);
    agent1.period.number.should.equal(0);
    myPool.push(agent0);
    myPool.push(agent1);
    myPool.initPeriod({ number: 5, startTime: 50000 });
    myPool.agents.length.should.equal(2);
    myPool.agents.forEach(function (A) {
      A.period.number.should.equal(5);
      A.wakeTime.should.be.above(50000);
    });
  });

  it('pool.initPeriod(5) sets all period numbers to 5, startTime to 5000, endTime to 6000, pool.endTime() yields 6000', function () {
    let myPool = new Pool();
    let agent0 = new Agent();
    let agent1 = new Agent();
    agent0.period.number.should.equal(0);
    agent1.period.number.should.equal(0);
    myPool.push(agent0);
    myPool.push(agent1);
    myPool.initPeriod(5);
    myPool.agents.length.should.equal(2);
    myPool.agents.forEach(function (A) {
      A.period.number.should.equal(5);
      A.period.startTime.should.equal(5000);
      A.period.endTime.should.equal(6000);
    });
    myPool.endTime().should.equal(6000);
  });

  it("pool.initPeriod([{number:1, init:{color:'blue'}},{number:1, init:{color:'red'}}]) with 3 agents in pool sets agents colors to blue, red, blue and all period numbers to 1", function () {
    let myPool = new Pool();
    [1, 2, 3].forEach(function () { myPool.push(new Agent()); });
    myPool.initPeriod([
      { number: 1, init: { color: 'blue' } },
      { number: 1, init: { color: 'red' } }
    ]);
    myPool.agents[0].period.number.should.equal(1);
    myPool.agents[1].period.number.should.equal(1);
    myPool.agents[2].period.number.should.equal(1);
    myPool.agents[0].color.should.equal('blue');
    myPool.agents[1].color.should.equal('red');
    myPool.agents[2].color.should.equal('blue');
  });

  it("initPeriod clears this.nextCache, next/nextCache behaves as expected", function(){
    let myPool = new Pool();
    [1,2].forEach(function(){ myPool.push(new Agent());});
    myPool.initPeriod(1);
    assert.ok(myPool.nextCache===undefined,"this.nextCache should be undefined");
    myPool.syncRun(2000);
    let next = myPool.next();
    next.should.equal(0);
    myPool.nextCache.should.equal(0);
    myPool.next().should.equal(0);
    myPool.initPeriod(2);
    assert.ok(myPool.nextCache===undefined,"this.nextCache should be undefined");
    myPool.next().should.be.instanceOf(Agent);
    myPool.nextCache.should.deepEqual(myPool.next());
  });

  it('pool.endPeriod with 2 agents in pool calls .endPeriod on each agent', function () {
    let myPool = new Pool();
    let agent0 = new Agent();
    let agent1 = new Agent();
    myPool.push(agent0);
    myPool.push(agent1);
    let ended = [0, 0];

    function handler(i) { return function () { ended[i] = 1; }; }
    agent0.on('post-period', handler(0));
    agent1.on('post-period', handler(1));
    myPool.endPeriod();
    ended.should.deepEqual([1, 1]);
  });

  function poolAgentRateTest(rates, AgentFunc, done) {
    let async = (typeof(done) === 'function');
    let numberOfAgents = rates.length;
    let wakes = new Array(numberOfAgents).fill(0);
    const allowedTime = 10000;
    let expected = rates.map(function (r) { return allowedTime * r; });

    function checkWakes() {
      wakes.forEach(function (wakeCount, i) {
        wakeCount.should.be.within(expected[i] - 5 * Math.sqrt(expected[i]), expected[i] + 5 * Math.sqrt(expected[i]));
      });
    }

    function incWakeFunc(i) { return function () { wakes[i]++; }; }
    let myAgent;
    let myPool = new Pool();
    for (let i = 0;i < numberOfAgents;++i) {
      myAgent = new AgentFunc({ rate: rates[i] });
      myAgent.on('wake', incWakeFunc(i));
      myPool.push(myAgent);
    }
    if (async) {
      (myPool
        .runAsPromise(allowedTime, 5)
        .then(function () {
          checkWakes();
          done();
        }, function (e) {
          throw new Error("pool should not throw error:" + e);
        })
      );
      // previous line should return before event loop runs, so wakeCount should be 0
      wakes.forEach(function (wakeCount) { wakeCount.should.equal(0); });
    } else {
      myPool.syncRun(allowedTime);
      checkWakes();
    }
  }

  it('pool with two agents, rate 1 and 1e-12 .syncRun', function(){
    poolAgentRateTest([1,1e-12], Agent);
  });

  it('pool with one agent, rate 1, .syncRun', function () {
    poolAgentRateTest([1], Agent);
  });

  it('pool with two agents, rate 1 and 1e-12  (runAsPromise)', function(done){
    poolAgentRateTest([1,1e-12], Agent, done);
  });

  it('pool with one agent, rate 1 (runAsPromise) ', function (done) {
    poolAgentRateTest([1], Agent, done);
  });

  it('pool with ten agents, rate 1 (syncRun) ', function () {
    poolAgentRateTest(new Array(10).fill(1), Agent);
  });

  it('pool with ten agents, rate 1 ', function (done) {
    poolAgentRateTest(new Array(10).fill(1), Agent, done);
  });

  it('pool with ten agents, rates [1,2,3,4,5,6,7,8,9,10] .syncRun ', function () {
    poolAgentRateTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], Agent);
  });

  it('pool with ten agents, rates [1,2,3,4,5,6,7,8,9,10], .runAsPromise ', function (done) {
    poolAgentRateTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], Agent, done);
  });

  it('pool with one zi Agent, rate 2 .syncRun ', function () {
    poolAgentRateTest([2], ZIAgent);
  });

  it('pool with one zi agent, rate 2, .runAsPromise ', function (done) {
    poolAgentRateTest([2], ZIAgent, done);
  });

  it('pool with 100 zi agents, rates [0.01,...,1] .syncRun(1000)', function () {
    let i, l;
    let rates = [];
    for (i = 0, l = 100;i < l;++i)
      rates[i] = (1 + i) / 100;
    poolAgentRateTest(rates, ZIAgent);
  });

  it('pool with 100 KaplanSniper agents, rates [0.1,0.11,...,1.09], check behavior for correct end-of-period sniping', function () {
    let agentBidLog = [];
    let agentAskLog = [];
    let bidCount = 0,
      askCount = 0;
    let currentBid = 40,
      currentAsk = 60;
    let i = 0,
      A = [];
    for (i = 0;i < 100;++i) {
      agentBidLog[i] = [];
      agentAskLog[i] = [];
    }
    let myPool = new Pool();
    let market = {
      goods: "X",
      currentBidPrice() { return currentBid; },
      currentAskPrice() { return currentAsk; },
      previousPeriod(prop) {
        if (prop === 'highPrice') return 101;
        if (prop === 'lowPrice') return 1;
      }
    };

    function ask(mymarket, price) {
      askCount++;
      mymarket.goods.should.equal("X");
      price.should.equal(currentBid);
      this.unitCostFunction("X", this.inventory).should.be.within(0, currentBid);
      agentAskLog[this.id].push(this.wakeTime);
    }

    function bid(mymarket, price) {
      bidCount++;
      mymarket.goods.should.equal("X");
      price.should.equal(currentAsk);
      this.unitValueFunction("X", this.inventory).should.be.within(currentAsk, 100);
      agentBidLog[this.id].push(this.wakeTime);
    }

    for (i = 1;i < 50;i++) {
      A[i] = new KaplanSniperAgent({
        id: i,
        desiredSpread: 8,
        rate: (i + 9.0) / 100.0,
        inventory: { 'X': 0, 'money': 1000 },
        markets: [market],
        costs: { 'X': [2 * i + 1] }
      });
      A[i].bid = bid;
      A[i].ask = ask;
      A[i].id.should.equal(i);
      myPool.push(A[i]);
    }
    for (i = 50;i < 100;i++) {
      A[i] = new KaplanSniperAgent({
        id: i,
        desiredSpread: 8,
        rate: (i + 9.0) / 100.0,
        inventory: { 'X': 0, 'money': 1000 },
        markets: [market],
        values: { 'X': [2 * (i - 50) + 1] }
      });
      A[i].bid = bid;
      A[i].ask = ask;
      A[i].id.should.equal(i);
      myPool.push(A[i]);
    }

    myPool.initPeriod({ number: 1, startTime: 1000, endTime: 2000 });
    myPool.syncRun(2000);
    // bidCount,askCount actually should be around 3x 20 = 60, but random, and want a test that will not fail often
    bidCount.should.be.above(20, 'not enough bids:' + bidCount);
    askCount.should.be.above(20, 'not enough asks:' + askCount);

    /* below we test that no bids or asks were earlier than the end-of-period rate-based snipe activation time
    and that no agent switched roles, i.e. no buyers were asking, no sellers were bidding */

    agentAskLog.forEach(function (L, j) {
      if (j === 0) return;
      if (j < 50) {
        let minT = 2000 - (A[j].nearEndOfPeriod / A[j].rate);
        L.forEach(function (tAsk) {
          tAsk.should.be.above(minT);
        });
      } else {
        L.length.should.equal(0);
      }
    });
    agentBidLog.forEach(function (L, j) {
      if (j === 0) return;
      if (j < 50) {
        L.length.should.equal(0);
      } else {
        let minT = 2000 - (A[j].nearEndOfPeriod / A[j].rate);
        L.forEach(function (tBid) {
          tBid.should.be.above(minT);
        });
      }
    });

  });

  it('pool with 10 generic agents, pool.Trade agent 0 buys 1 X@400 from agent 5, correct inventories',
    function () {
      let pool = new Pool();
      for (let i = 0, l = 10;i < l;++i)
        pool.push(new Agent({ inventory: { 'X': 0, 'money': 1000 } }));
      pool.agents.forEach(function (A) {
        A.inventory.X.should.equal(0);
        A.inventory.money.should.equal(1000);
      });
      let tradeSpec = {
        bs: 'b',
        goods: 'X',
        money: 'money',
        buyQ: [1],
        sellQ: [1],
        buyId: [pool.agents[0].id],
        sellId: [pool.agents[5].id],
        prices: [400]
      };
      pool.trade(tradeSpec);
      pool.agents.forEach(function (A, i) {
        if (i === 0) {
          A.inventory.X.should.equal(1);
          A.inventory.money.should.equal(600);
        } else if (i === 5) {
          A.inventory.X.should.equal(-1);
          A.inventory.money.should.equal(1400);
        } else {
          A.inventory.X.should.equal(0);
          A.inventory.money.should.equal(1000);
        }
      });
    });

  it('pool with 10 agents, pool.Trade agent 0 buys 1 X@400 from agent 5, 1 X@450 from agent 6, correct inventories',
    function () {
      let pool = new Pool();
      for (let i = 0, l = 10;i < l;++i)
        pool.push(new Agent({ inventory: { 'X': 0, 'money': 1000 } }));
      pool.agents.forEach(function (A) {
        A.inventory.X.should.equal(0);
        A.inventory.money.should.equal(1000);
      });
      let tradeSpec = {
        bs: 'b',
        goods: 'X',
        money: 'money',
        buyQ: [2],
        sellQ: [1, 1],
        buyId: [pool.agents[0].id],
        sellId: [pool.agents[5].id, pool.agents[6].id],
        prices: [400, 450]
      };
      pool.trade(tradeSpec);
      pool.agents.forEach(function (A, i) {
        if (i === 0) {
          A.inventory.X.should.equal(2);
          A.inventory.money.should.equal(150);
        } else if (i === 5) {
          A.inventory.X.should.equal(-1);
          A.inventory.money.should.equal(1400);
        } else if (i === 6) {
          A.inventory.X.should.equal(-1);
          A.inventory.money.should.equal(1450);
        } else {
          A.inventory.X.should.equal(0);
          A.inventory.money.should.equal(1000);
        }
      });
    });

  it('pool with 10 agents, pool.Trade agent 2 sells 1 X@175 to agent 6, correct inventories',
    function () {
      let pool = new Pool();
      for (let i = 0, l = 10;i < l;++i)
        pool.push(new Agent());
      pool.agents.forEach(function (A) {
        A.inventory.should.deepEqual({ 'money': 0 });
      });
      let tradeSpec = {
        bs: 's',
        goods: 'X',
        money: 'money',
        buyQ: [1],
        sellQ: [1],
        buyId: [pool.agents[6].id],
        sellId: [pool.agents[2].id],
        prices: [175]
      };
      pool.trade(tradeSpec);
      pool.agents.forEach(function (A, i) {
        if (i === 2) {
          A.inventory.X.should.equal(-1);
          A.inventory.money.should.equal(175);
        } else if (i === 6) {
          A.inventory.X.should.equal(1);
          A.inventory.money.should.equal(-175);
        } else {
          A.inventory.should.deepEqual({ money: 0 });
        }
      });
    });

  it('pool with 10 agents, pool.Trade agent 2 sells 1 X@175 to agent 6, 2 X@150 to agent 4, correct inventories',
    function () {
      let pool = new Pool();
      for (let i = 0, l = 10;i < l;++i)
        pool.push(new Agent());
      pool.agents.forEach(function (A) {
        A.inventory.should.deepEqual({ money: 0 });
      });
      let tradeSpec = {
        bs: 's',
        goods: 'X',
        money: 'money',
        buyQ: [1, 2],
        sellQ: [3],
        buyId: [pool.agents[6].id, pool.agents[4].id],
        sellId: [pool.agents[2].id],
        prices: [175, 150]
      };
      pool.trade(tradeSpec);
      pool.agents.forEach(function (A, i) {
        if (i === 2) {
          A.inventory.X.should.equal(-3);
          A.inventory.money.should.equal(475);
        } else if (i === 4) {
          A.inventory.X.should.equal(2);
          A.inventory.money.should.equal(-300);
        } else if (i === 6) {
          A.inventory.X.should.equal(1);
          A.inventory.money.should.equal(-175);
        } else {
          A.inventory.should.deepEqual({ money: 0 });
        }
      });
    });

    it('pool with 10 agents, pool.Trade agent 2 sells 1 X@175 to agent 6, 2 X@150 to agent 4, tradeSpec.bs invalid, throws',
      function () {
        let pool = new Pool();
        for (let i = 0, l = 10;i < l;++i)
          pool.push(new Agent());
        pool.agents.forEach(function (A) {
          A.inventory.should.deepEqual({ money: 0 });
        });
        let tradeSpec = {
          bs: 'w',
          goods: 'X',
          money: 'money',
          buyQ: [1, 2],
          sellQ: [3],
          buyId: [pool.agents[6].id, pool.agents[4].id],
          sellId: [pool.agents[2].id],
          prices: [175, 150]
        };
        function bad(){
          pool.trade(tradeSpec);
        }
        bad.should.throw(/must be b or s/);
      });

  it('pool.trade() undefined tradespec is ignored', function(){
    const pool = new Pool();
    assert(pool.trade()===undefined);
  });

  it("pool.trade(badObject) should throw /format/", function(){
      const badObjects = [
        {},
        [],
        23,
        false,
        true,
        new Date()
      ];
      badObjects.forEach((tradeSpec)=>{
        const a = new Pool();
        function bad(){
          a.trade(tradeSpec);
        }
        bad.should.throw(/format/);
      });
    });
  });

  function badTradeTest(bs, invalidSum) {
    let i, l;
    let pool = new Pool();
    for (i = 0, l = 10;i < l;++i)
      pool.push(new Agent());
    pool.agents.forEach(function (A) {
      A.inventory.should.deepEqual({ money: 0 });
    });
    let tradeSpec = {
      bs,
      goods: 'X',
      money: 'money',
      buyQ: [2, 2],
      sellQ: [2, 2],
      buyId: [pool.agents[6].id, pool.agents[4].id],
      sellId: [pool.agents[2].id, pool.agents[3].id],
      prices: [175, 150]
    };
    if (invalidSum) {
      if (bs === 'b') {
        tradeSpec.buyId = tradeSpec.buyId.slice(0, 1);
        tradeSpec.buyQ = [3];
      } else {
        tradeSpec.sellId = tradeSpec.sellId.slice(0, 1);
        tradeSpec.sellQ = [3];
      }
    }

    function doNotDoThis() {
      pool.trade(tradeSpec);
    }
    doNotDoThis.should.throw();
    pool.agents.forEach(function (A) {
      A.inventory.should.deepEqual({ money: 0 });
    });
  }

  it('pool.trade throws error on bad buy trade with multiple tradeSpec.buyId entries, inventories unchanged',
    function () {
      badTradeTest('b');
    });

  it('pool.trade throws error on bad buy trade with buyQ[0] sum not equal to sum over i of sellQ[i], inventories unchanged',
    function () {
      badTradeTest('b', true);
    });

  it('pool.trade throws error on bad sell trade with multiple tradeSpec.sellId entries, inventories unchanged',
    function () {
      badTradeTest('s');
    });

  it('pool.trade throws error on bad sell trade with sellQ[0] sum not equal to sum over i of buyQ[i], inventories unchanged',
    function () {
      badTradeTest('s', true);
    });

  it("pool.distribute('foo','X',[100,50,30]) should throw /field/", function(){
    const myPool = new Pool();
    function bad(){
      myPool.distribute('foo','X',[100,50,30]);
    }
    bad.should.throw(/field/);
  });

  it("pool.distribute('values','X',[100,80,60,50,40,30,20,10]) over 5 agents", function () {
    let myPool = new Pool();
    [1, 2, 3, 4, 5].forEach(function () { myPool.push(new Agent()); });
    myPool.distribute('values', 'X', [100, 80, 60, 50, 40, 30, 20, 10]);
    myPool.agents[0].values.X.should.deepEqual([100, 30]);
    myPool.agents[1].values.X.should.deepEqual([80, 20]);
    myPool.agents[2].values.X.should.deepEqual([60, 10]);
    myPool.agents[3].values.X.should.deepEqual([50]);
    myPool.agents[4].values.X.should.deepEqual([40]);
  });

  it("pool.distribute('values','X','100 80 60 50 40 30 20 10') throws error as array expected", function () {
    let myPool = new Pool();
    [1, 2, 3, 4, 5].forEach(function () { myPool.push(new Agent()); });

    function tryDistribute() {
      myPool.distribute('values', 'X', "100 80 60 50 40 30 20 10");
    }
    tryDistribute.should.throw();
  });

  it("pool.distribute('values','X',[100,80,60,50,40,30,20,10]) over 10 agents", function () {
    let myPool = new Pool();
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function () { myPool.push(new Agent()); });
    myPool.distribute('values', 'X', [100, 80, 60, 50, 40, 30, 20, 10]);
    myPool.agents[0].values.X.should.deepEqual([100]);
    myPool.agents[1].values.X.should.deepEqual([80]);
    myPool.agents[2].values.X.should.deepEqual([60]);
    myPool.agents[3].values.X.should.deepEqual([50]);
    myPool.agents[4].values.X.should.deepEqual([40]);
    myPool.agents[5].values.X.should.deepEqual([30]);
    myPool.agents[6].values.X.should.deepEqual([20]);
    myPool.agents[7].values.X.should.deepEqual([10]);
    myPool.agents[8].values.X.should.deepEqual([]);
    myPool.agents[9].values.X.should.deepEqual([]);
  });
