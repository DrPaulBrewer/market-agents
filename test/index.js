/* jshint esnext:true */

var assert = require('assert');
var should = require('should');
const MarketAgents = require("../index.js");
const Agent = MarketAgents.Agent;
const ziAgent = MarketAgents.ziAgent;
const Pool = MarketAgents.Pool;

describe('MarketAgents', function(){
    
    it('should be an object', function(){
	MarketAgents.should.be.type('object');
    });

    var props = ['Agent','ziAgent','unitAgent','KaplanSniperAgent','Pool'];

    it('should have properties '+props.join(" "), function(){
	MarketAgents.should.have.properties(props);
    });

});

describe('new Agent', function(){
    it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
       function(){ 
	   var myAgent = new Agent();
	   myAgent.should.be.type('object');
	   myAgent.should.have.properties('id','description','inventory','wakeTime','rate','nextWake','period');
	   myAgent.id.should.be.type('number');
	   myAgent.description.should.be.type('string');
	   myAgent.inventory.should.be.type('object');
	   myAgent.wakeTime.should.be.type('number');
	   myAgent.rate.should.be.type('number');
	   myAgent.nextWake.should.be.type('function');
	   myAgent.period.should.be.type('object');
       });
    
    it('should have ascending default id number', function(){
	var agent1 = new Agent();
	var agent2 = new Agent();
	assert.ok(agent1.id>0);
	assert.ok(agent2.id>0);
	assert.ok(agent2.id>agent1.id);
    });
    
    it('test 100 wakes, should have ascending wake times', function(){
	var agent = new Agent();
	var i,l;
	var t0,t1;
	var wakes = 0;
	agent.on('wake',function(){ wakes++; });
	for(i=0,l=100;i<l;i++){
	    t0 = agent.wakeTime;
	    agent.wake();
	    t1 = agent.wakeTime;
	    assert.ok(t1>t0);
	}
	assert.ok(wakes===100);
    });

    it('test 100 wakes, agent with rate 2 should use between 1/3 and 2/3 the time of agent with rate 1', function(){
	var agent1 = new Agent();
	var agent2 = new Agent({rate: 2});
	var i,l;
	var wakes1=0, wakes2=0;
	agent1.on('wake', function(){ wakes1++; });
	agent2.on('wake', function(){ wakes2++; });
	for(i=0,l=100;i<l;++i){
	    agent1.wake();
	    agent2.wake();
	}
	assert.ok(wakes1===100);
	assert.ok(wakes2===100);
	assert.ok(agent2.wakeTime>(0.33*agent1.wakeTime));
	assert.ok(agent2.wakeTime<(0.67*agent1.wakeTime));	
    });

    it('with period.endTime set wake up to 10000 times until wakeTime is undefined; .wakeTime, .pctPeriod increasing, .poissonWakesRemainingInPeriod decreasing, check formulas for pct, wakes', function(){
	/* set rate to something other than 1 to test as 1/1===1 and reciprocal error could creep in */
	var agent = new Agent({rate:2.7});
	agent.initPeriod(0);
	assert.ok(agent.period.endTime>0);
	var j = 0;
	var lastWakeTime = 0;
	var lastPctPeriod = 0;
	var lastRemaining = Infinity;
	var wakeTime=agent.wakeTime, pctPeriod, remaining;
	var approxRemaining;
	while (agent.wakeTime && (++j<10000)){
	    pctPeriod = agent.pctPeriod();
	    remaining = agent.poissonWakesRemainingInPeriod();
	    wakeTime.should.be.above(lastWakeTime);
	    pctPeriod.should.be.above(lastPctPeriod);
	    pctPeriod.should.be.approximately( (agent.wakeTime-agent.period.startTime)/ (agent.period.endTime-agent.period.startTime), 0.001);
	    remaining.should.be.below(lastRemaining);
	    approxRemaining = (agent.period.endTime-agent.wakeTime)*agent.rate;
	    approxRemaining.should.be.type("number");
	    remaining.should.be.approximately(approxRemaining , 0.001);
	    assert.ok((pctPeriod > 0) && (pctPeriod<1));
	    assert.ok(remaining > 0);
	    lastWakeTime = wakeTime;
	    lastPctPeriod = pctPeriod;
	    lastRemaining = remaining;
	    agent.wake();
	    wakeTime = agent.wakeTime;
	}
	assert.ok(j>100);
	assert.ok(agent.wakeTime===undefined);
    });

    it('wake 10000 times with no period.endTime yields .wakeTime within [9500,10500]', function(){
	var agent = new Agent();
	var i,l;
	if (agent.period.endTime)
	    delete agent.period.endTime; 
	for(i=0,l=10000;i<l;++i)
	    agent.wake();
	agent.wakeTime.should.be.within(9500,10500);
    });
	    
    describe('agent-period cycle interactions', function(){
	function setup(){
	    var someMoneyNoX = {money: 1000, X:0};
	    var period = {number:0, duration:1000, equalDuration:true, init:{inventory: someMoneyNoX}};
	    var agent0 = new Agent();
	    var agent1 = new Agent();
	    agent0.initPeriod(period);
	    agent1.initPeriod(period);
	    return [agent0, agent1];
	}
	it('should initially be at period 0', function(){
	    var agents = setup();
	    agents[0].period.number.should.equal(0);
	    agents[1].period.number.should.equal(0);
	});
	it('agents 1,2  should show initial inventory 0 X 1000 Money', function(){
	    var agents = setup();
	    assert.ok(agents[0].inventory.X===0);
	    assert.ok(agents[0].inventory.money===1000);
	    assert.ok(agents[1].inventory.X===0);
	    assert.ok(agents[1].inventory.money===1000);
	});
	it('after Transfer of +1X, -500 Money, agent 1 should show 1 X, 500 Money; agent 1 endowment, agent 2 unaffected', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    assert.ok(agents[0].inventory.X===1);
	    assert.ok(agents[0].inventory.money===500);
	    assert.ok(agents[1].inventory.X===0);
	    assert.ok(agents[1].inventory.money===1000);
	});
	it('agents should emit post-period when .endPeriod is called', function(){
	    var agents = setup();
	    var ended = [0,0];
	    agents.forEach(function(a,i){ a.on('post-period', function(){ ended[i]=1; }); });
	    agents.forEach(function(a){ a.endPeriod(); });
	    ended.should.deepEqual([1,1]);
	});
	it('agents should indicate period number:1, startTime:1000, endTime:2000 after set with .initPeriod({number:1, ... })', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    agents.forEach(function(a){ a.initPeriod(Object.assign({},a.period,{number:1})); });
	    agents.forEach(function(a){
		assert.ok(a.period.number===1);
		assert.ok(a.period.startTime === 1000 );
		assert.ok(a.period.endTime === 2000 );
	    });
	});
	it('agents should indicate period number:1, startTime:1000, endTime:2000  after set with .initPeriod(1)', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    agents.forEach(function(a){ a.initPeriod(1); });
	    agents.forEach(function(a){
		assert.ok(a.period.number===1);
		assert.ok(a.period.startTime === 1000 );
		assert.ok(a.period.endTime === 2000 );
	    });
	});
	it('agents 1,2, should show initial inventory 0 X, 1000 Money for Period 1', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    agents.forEach(function(a){ a.initPeriod(Object.assign({},a.period,{number:1}))});
	    assert.ok(agents[0].inventory.X===0);
	    assert.ok(agents[0].inventory.money===1000);
	    assert.ok(agents[1].inventory.X===0);
	    assert.ok(agents[1].inventory.money===1000);
	});
	it('agent 1 given 2Y should still have 2Y after period reset as Y amount unspecified in period.init.inventory', function(){
	    var agents = setup();
	    var give1Y = {Y:1};
	    agents[0].transfer(give1Y);
	    assert.ok(agents[0].inventory.Y===1);
	    agents.forEach(function(a){a.initPeriod(Object.assign({},a.period,{number:1}))});
	    assert.ok(agents[0].inventory.X===0);
	    assert.ok(agents[0].inventory.money===1000);
	    assert.ok(agents[0].inventory.Y===1);
	    assert.ok(agents[1].inventory.X===0);
	    assert.ok(agents[1].inventory.money===1000);
	});

	it('agent end of period redemption, zeroed X and correct end-of-period money balance', function(){
	    var period1 = { 
		number: 1,
		init: {
		    inventory: {'money': 1000, 'X':0, 'Y':1},
		    values: {'X': [500,400,300,200,100,1,1,1,1,1,1,1]}
		}
	    };
	    var agents = setup();
	    agents[0].initPeriod(period1);
	    agents[1].initPeriod(period1);
	    agents[0].transfer({'X':5});
	    agents[1].transfer({'X':2});
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


	it('agent end of period production, zeroed X and correct end-of-period money balance', function(){
	    var period1 = { 
		number: 1,
		init: {
		    inventory: {'money': 1000, 'X':0, 'Y':1},
		    costs: {'X': [100,200,300,400,500,600,700,800,900,1000]}
		}
	    };
	    var agents = setup();
	    agents[0].initPeriod(period1);
	    agents[1].initPeriod(period1);
	    agents[0].transfer({'X':-5});
	    agents[1].transfer({'X':-2});
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
    
describe('new ziAgent', function(){
    it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
       function(){ 
	   var myAgent = new ziAgent();
	   myAgent.should.be.type('object');
	   myAgent.should.have.properties('id','description','inventory','wakeTime','rate','nextWake','period');
	   myAgent.id.should.be.type('number');
	   myAgent.description.should.be.type('string');
	   myAgent.inventory.should.be.type('object');
	   myAgent.wakeTime.should.be.type('number');
	   myAgent.rate.should.be.type('number');
	   myAgent.nextWake.should.be.type('function');
	   myAgent.period.should.be.type('object');
       });
    
    it('should have properties markets, values, costs, minPrice, maxPrice with proper types', function(){
	var zi = new ziAgent();
	zi.should.have.properties('markets','values','costs','minPrice','maxPrice');
	zi.markets.should.be.type('object');
	zi.values.should.be.type('object');
	zi.costs.should.be.type('object');
	zi.minPrice.should.be.type('number');
	zi.maxPrice.should.be.type('number');
    });

    it('should not call this.bid() or this.ask() on this.wake() if values and costs not configured', function(){
	var zi = new ziAgent({markets:[{goods:'X'}]});
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(){ bids++; };
	zi.ask = function(){ asks++; };
	zi.wake();
	wakes.should.equal(1);
	bids.should.equal(0);
	asks.should.equal(0);
    });

    it('should call this.bid() on this.wake() if values configured', function(){
	var zi = new ziAgent({markets: [{goods:"X"}]});
	zi.initPeriod({number:0, startTime:0, init: {inventory: {coins:0, X:0, Y:0 }, values: {X: [100,1,1]}}});
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(market, p){ 
	    assert.ok(market.goods==='X');
	    p.should.be.type('number');
	    p.should.be.within(0,100);
	    bids++; 
	};
	zi.ask = function(){ asks++; };
	zi.wake();
	wakes.should.equal(1);
	bids.should.equal(1);
	asks.should.equal(0);	
    });

    it('should call this.ask() on this.wake() if costs configured', function(){
	var zi = new ziAgent({markets: [{goods:"X"}]});
	zi.initPeriod({number:0, startTime:0, init: {inventory: {coins:0, X:0, Y:0 }, costs: {X: [100,1000,1000]}}});
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(good, p){ 
	    bids++; 
	};
	zi.ask = function(market,p){ 
	    market.goods.should.equal('X');
	    p.should.be.type('number');
	    p.should.be.within(100,1000);
	    asks++; 
	};
	zi.wake();
	wakes.should.equal(1);
	bids.should.equal(0);
	asks.should.equal(1);	
    });

    it('should call this.bid() on Y market and this.ask() on X market on this.wake() if both values and  costs configured', function(){
	var zi = new ziAgent({
	    inventory: {coins:0, X:0, Y:0},
	    markets: [{goods:"X"}, {goods:"Y"}], 
	    costs: {X: [100]}, 
	    values: {Y: [50]},
	    maxPrice:1000
	});
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(market, p){ 
	    bids++; 
	    market.goods.should.equal('Y');
	    p.should.be.type('number');
	    p.should.be.within(0,100);
	};
	zi.ask = function(market,p){ 
	    market.goods.should.equal('X');
	    p.should.be.type('number');
	    p.should.be.within(50,1000);
	    asks++; 
	};
	zi.wake();
	wakes.should.equal(1);
	bids.should.equal(1);
	asks.should.equal(1);	
    });    

    it('should not call this.bid() or this.ask() on this.wake() if this.bidPrice or this.askPrice returns falsey',function(){
	var zi = new ziAgent({
	    inventory: {coins:0, X:0, Y:0},
	    markets: {X:1,Y:1}, 
	    costs: {X: [100]}, 
	    values: {Y: [50]},
	    maxPrice:1000
	});
	zi.bidPrice = function(v){ };
	zi.askPrice = function(c){ return 0; };
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(good, p){ 
	    bids++; 
	};
	zi.ask = function(good,p){ 
	    asks++; 
	};
	zi.wake();
	wakes.should.equal(1);
	bids.should.equal(0);
	asks.should.equal(0);	
    });

    it('10000 tests this.bidPrice(v) should return number  between minPrice and v', function(){
	var zi = new ziAgent();
	var i,l,p;
	for(i=1,l=10001; i<l; i++){
	    p = zi.bidPrice(i);
	    p.should.be.within(0,i);
	    Math.floor(p).should.not.equal(p);
	}
	zi.minPrice = 1;
	assert.ok(typeof(zi.bidPrice(0.5))==='undefined');
	zi.bidPrice(zi.minPrice).should.equal(zi.minPrice);
	zi.integer = true;
	for(i=1,l=10000; i<l; i++){
	    p = zi.bidPrice(i);
	    p.should.be.within(1,i);
	    Math.floor(p).should.equal(p);
	}
    });

    it('10000 tests this.askPrice(c) should return number between c and maxPrice', function(){
	var zi = new ziAgent({maxPrice: 12345});
	var i,l,p;
	for(i=1,l=10001;i<l;i++){
	    p = zi.askPrice(i);
	    p.should.be.within(i,12345);
	    Math.floor(p).should.not.equal(p);
	}
	zi.maxPrice = 11111;
	assert.ok(typeof(zi.askPrice(22222))==='undefined');
	zi.integer=true;
	for(i=1,l=10000;i<l;++i){
	    p = zi.askPrice(i);
	    p.should.be.within(i,11111);
	    Math.floor(p).should.equal(p);
	}
	zi.askPrice(zi.maxPrice).should.equal(zi.maxPrice);	
    });

    it('10000 tests with ignoreBudgetConstraint,  integer: this.bidPrice(50) should return every number between this.minPrice and this.maxPrice inclusive',
       function(){
	   var zi = new ziAgent({integer:true, ignoreBudgetConstraint:true, minPrice:10, maxPrice:90 });
	   var i,l,p;
	   var bins = Array(100).fill(0);
	   for(i=0,l=10000;i<l;++i){
	       p = zi.bidPrice(50);
	       Math.floor(p).should.equal(p);
	       bins[p]++;
	   }
	   for(i=0,l=10;i<l;++i)
	       bins[i].should.equal(0);
	   for(i=10,l=91;i<l;++i)
	       bins[i].should.be.above(0);
	   for(i=91,l=100;i<l;++i)
	       bins[i].should.equal(0);
       });

    it('10000 tests with ignoreBudgetConstraint,  integer: this.askPrice(50) should return every number between this.minPrice and this.maxPrice inclusive',
       function(){
	   var zi = new ziAgent({integer:true, ignoreBudgetConstraint:true, minPrice:10, maxPrice:90 });
	   var i,l,p;
	   var bins = Array(100).fill(0);
	   for(i=0,l=10000;i<l;++i){
	       p = zi.askPrice(50);
	       Math.floor(p).should.equal(p);
	       bins[p]++;
	   }
	   for(i=0,l=10;i<l;++i)
	       bins[i].should.equal(0);
	   for(i=10,l=91;i<l;++i)
	       bins[i].should.be.above(0);
	   for(i=91,l=100;i<l;++i)
	       bins[i].should.equal(0);
       });
    
    it('this.bidPrice and this.askPrice return undefined if input value is undefined, irregardless of integer or ignoreBudgetConstraint settings',
       function(){
	   var zi;
	   var intflag, ignoreflag;
	   var flags = [[0,0],[0,1],[1,0],[1,1]];
	   flags.forEach(function(f){
	       var zi = new ziAgent({minPrice:10, maxPrice:90, ignoreBudgetConstraint:f[0], integer:f[1]});
	       assert.ok(typeof(zi.bidPrice())==='undefined');
	       assert.ok(typeof(zi.askPrice())==='undefined');
	   });
       });
 

    it('sample of 101000 integer this.bidPrice(v=100) chi-square test for uniformity on [0,100] inclusive with every bin hit', function(){
	var zi = new ziAgent({integer: true});
	var i,l,p;
	var bins = new Array(101).fill(0);
	var sumsq = 0;
	var chisq100 = 0;
	var e = 0;
	var norm = 0;
	for(i=0,l=101000; i<l; i++){
	    p = zi.bidPrice(100);
	    p.should.be.within(0,100);
	    bins[p]++;
	}
	for(i=0,l=101;i<l;++i){
	    assert.ok(bins[i]>0, "bid bin "+i+" empty");
	    e = bins[i]-1000;
	    sumsq += e*e;
	}
	chisq100=sumsq/1000.0;
	norm = (chisq100-100)/Math.sqrt(2*100);
	norm.should.be.within(-5,5);
    });

    it('sample of 101000 integer this.askPrice(c=50) chi-square test for uniformity on [50,maxPrice=150] inclusive with every bin hit', function(){
	var zi = new ziAgent({integer: true, maxPrice:150});
	var i,l,p;
	var bins = new Array(101).fill(0);
	var sumsq = 0;
	var chisq100 = 0;
	var e = 0;
	var norm = 0;
	for(i=0,l=101000; i<l; i++){
	    p = zi.askPrice(50);
	    p.should.be.within(50,150);
	    bins[p-50]++;
	}
	for(i=0,l=101;i<l;++i){
	    assert.ok(bins[i]>0, "ask bin "+i+" empty");
	    e = bins[i]-1000;
	    sumsq += e*e;
	}
	chisq100=sumsq/1000.0;
	norm = (chisq100-100)/Math.sqrt(2*100);
	norm.should.be.within(-5,5);
    });    
});

describe('new unitAgent', function(){
   it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
       function(){ 
	   var myAgent = new unitAgent();
	   myAgent.should.be.type('object');
	   myAgent.should.have.properties('id','description','inventory','wakeTime','rate','nextWake','period');
	   myAgent.id.should.be.type('number');
	   myAgent.description.should.be.type('string');
	   myAgent.inventory.should.be.type('object');
	   myAgent.wakeTime.should.be.type('number');
	   myAgent.rate.should.be.type('number');
	   myAgent.nextWake.should.be.type('function');
	   myAgent.period.should.be.type('object');
       });
    
    it('should have properties markets, values, costs, minPrice, maxPrice with proper types', function(){
	var a = new unitAgent();
	a.should.have.properties('markets','values','costs','minPrice','maxPrice');
	a.markets.should.be.type('object');
	a.values.should.be.type('object');
	a.costs.should.be.type('object');
	a.minPrice.should.be.type('number');
	a.maxPrice.should.be.type('number');
    });

    it('should not call this.bid() or this.ask() on this.wake() if values and costs not configured', function(){
	var a = new unitAgent();
	var wakes=0,bids=0,asks=0;
	a.on('wake', function(){ wakes++; });
	a.bid = function(){ bids++; };
	a.ask = function(){ asks++; };
	a.wake();
	wakes.should.equal(1);
	bids.should.equal(0);
	asks.should.equal(0);
    });

    it('this.bidPrice and this.askPrice return undefined if input value is undefined, irregardless of integer or ignoreBudgetConstraint settings',
       function(){
	   var intflag, ignoreflag;
	   var flags = [[0,0],[0,1],[1,0],[1,1]];
	   flags.forEach(function(f){
	       var a = new unitAgent({minPrice:10, maxPrice:90, ignoreBudgetConstraint:f[0], integer:f[1]});
	       assert.ok(typeof(a.bidPrice())==='undefined');
	       assert.ok(typeof(a.askPrice())==='undefined');
	   });
       });

    it('this.bidPrice and this.askPrice should throw on valid input if this.getPreviousPrice function does not exist', function(){
	var call_bidPrice_with_no_get_previous_price = function(){
	    var a = new unitAgent({minPrice:10, maxPrice:90});
	    var p = a.bidPrice(50);
	};
	var call_askPrice_with_no_get_previous_price = function(){
	    var a = new unitAgent({minPrice:10, maxPrice:90});
	    var p = a.askPrice(60);
	};
	call_bidPrice_with_no_get_previous_price.should.throw();
	call_askPrice_with_no_get_previous_price.should.throw();
    });

    it('this.bidPrice(50) is undefined if market.lastTradePrice()===51.01', function(){
	var a = new unitAgent({minPrice:10, maxPrice:90});
	var market = {
	    lastTradePrice: function(){ return 51.01; }
	};
	var i,l,p;
	for(i=0,l=100;i<l;++i){
	    p = a.bidPrice(50, market);
	    assert(typeof(p)==='undefined', p);
	}
	a.integer = true;
	for(i=0,l=100;i<l;++i){
	    p = a.bidPrice(50, market);
	    assert(typeof(p)==='undefined', p);
	}
    });

    it('this.bidPrice(50) is 32,33,34 approx 1/3 of time if .integer===true, market.lastTradePrice()===33', function(){
	var a = new unitAgent({minPrice: 10, maxPrice:90, integer: true});
	var market = {};
	market.lastTradePrice = function(){ return 33; };
	var i,l,p;
	var bin = Array(100).fill(0);
	for(i=0,l=30000;i<l;++i){
	    p = a.bidPrice(50, market);
	    bin[Math.floor(p)]++;
	}
	bin[31].should.equal(0);
	bin[32].should.be.within(9500,10500);
	bin[33].should.be.within(9500,10500);
	bin[34].should.be.within(9500,10500);
	bin[35].should.equal(0);
    });

    it('this.bidPrice(50) is 32-33, 33-34 approx 1/2 of time if .integer===false, market.lastTradePrice()===33', function(){
	var a = new unitAgent({minPrice: 10, maxPrice:90});
	var market = { lastTradePrice: function(){ return 33; } };
	var i,l,p;
	var bin = Array(100).fill(0);
	for(i=0,l=20000;i<l;++i){
	    p = a.bidPrice(50, market);
	    bin[Math.floor(p)]++;
	}
	bin[31].should.equal(0);
	bin[32].should.be.within(9500,10500);
	bin[33].should.be.within(9500,10500);
	bin[34].should.equal(0);
	bin[35].should.equal(0);
    });

    it('this.bidPrice(33) is 32-33, undefined approx 1/2 of time if .integer===false, market.lastTradePrice()===33', function(){
	var a = new unitAgent({minPrice: 10, maxPrice:90});
	var market = { lastTradePrice: function(){ return 33; } };
	var i,l,p,un=0;
	var bin = Array(100).fill(0);
	for(i=0,l=20000;i<l;++i){
	    p = a.bidPrice(33, market);
	    if (p)
		bin[Math.floor(p)]++;
	    else
		un++;
	}
	un.should.be.within(9500,10500);
	bin[31].should.equal(0);
	bin[32].should.be.within(9500,10500);
	bin[33].should.equal(0);
	bin[34].should.equal(0);
	bin[35].should.equal(0);
    });

    it('this.askPrice(50) is undefined if market.lastTradePrice()===48.99', function(){
	var a = new unitAgent({minPrice:10, maxPrice:90});
	var market = { lastTradePrice: function(){ return 48.99; } };
	var i,l,p;
	for(i=0,l=100;i<l;++i){
	    p = a.askPrice(50, market);
	    assert(typeof(p)==='undefined', p);
	}
	a.integer=true;
	for(i=0,l=100;i<l;++i){
	    p = a.askPrice(50, market);
	    assert(typeof(p)==='undefined', p);
	}
    });

    it('this.askPrice(25) is 32,33,34 approx 1/3 of time if ,integer===true, market.lastTradePrice()===33', function(){
	var a = new unitAgent({minPrice: 10, maxPrice:90, integer: true});
	var market = { lastTradePrice: function(){ return 33; } };
	var i,l,p;
	var bin = Array(100).fill(0);
	for(i=0,l=30000;i<l;++i){
	    p = a.askPrice(25, market);
	    bin[Math.floor(p)]++;
	}
	bin[31].should.equal(0);
	bin[32].should.be.within(9500,10500);
	bin[33].should.be.within(9500,10500);
	bin[34].should.be.within(9500,10500);
	bin[35].should.equal(0);
    });

    it('this.askPrice(25) is 32-33, 33-34 approx 1/2 of time if ,integer===false, market.lastTradePrice()===33', function(){
	var a = new unitAgent({minPrice: 10, maxPrice:90});
	var market = { lastTradePrice: function(){ return 33; } };
	var i,l,p;
	var bin = Array(100).fill(0);
	for(i=0,l=20000;i<l;++i){
	    p = a.askPrice(25, market);
	    bin[Math.floor(p)]++;
	}
	bin[31].should.equal(0);
	bin[32].should.be.within(9500,10500);
	bin[33].should.be.within(9500,10500);
	bin[34].should.equal(0);
	bin[35].should.equal(0);
    });
});

describe('new KaplanSniperAgent', function(){

    function testKaplanSniperAgent(agentConfig, agentInfo, call, param, correctValue){
	var a = new KaplanSniperAgent(agentConfig);
	var market = {};
	var message = "config: "+JSON.stringify(agentConfig)+"\n"+
	    "info: "+JSON.stringify(agentInfo)+"\n"+
	    "call: "+call+"\n"+
	    "param: "+param+"\n"+
	    "correct: "+correctValue;
	market.currentBidPrice = function(){ return agentInfo.currentBidPrice; };
	market.currentAskPrice = function(){ return agentInfo.currentAskPrice; };
	a.getJuicyBidPrice = function(){ return agentInfo.juicyBidPrice; };
	a.getJuicyAskPrice = function(){ return agentInfo.juicyAskPrice; };
	if (correctValue===undefined)
	    assert.strictEqual(typeof(a[call](param, market)), "undefined", message);
	else
	    assert.strictEqual(a[call](param, market), correctValue, message);
    }

   it('should have properties id, description, inventory, wakeTime, rate, nextWake, period with proper types',
       function(){ 
	   var myAgent = new KaplanSniperAgent();
	   myAgent.should.be.type('object');
	   myAgent.should.have.properties('id','description','inventory','wakeTime','rate','nextWake','period');
	   myAgent.id.should.be.type('number');
	   myAgent.description.should.be.type('string');
	   myAgent.inventory.should.be.type('object');
	   myAgent.wakeTime.should.be.type('number');
	   myAgent.rate.should.be.type('number');
	   myAgent.nextWake.should.be.type('function');
	   myAgent.period.should.be.type('object');
       });
    
    it('should have properties markets, values, costs, minPrice, maxPrice with proper types', function(){
	var a = new KaplanSniperAgent();
	a.should.have.properties('markets','values','costs','minPrice','maxPrice');
	a.markets.should.be.type('object');
	a.values.should.be.type('object');
	a.costs.should.be.type('object');
	a.minPrice.should.be.type('number');
	a.maxPrice.should.be.type('number');
    });

    it('should not call this.bid() or this.ask() on this.wake() if values and costs not configured', function(){
	var a = new KaplanSniperAgent();
	var wakes=0,bids=0,asks=0;
	a.on('wake', function(){ wakes++; });
	a.bid = function(){ bids++; };
	a.ask = function(){ asks++; };
	a.wake();
	wakes.should.equal(1);
	bids.should.equal(0);
	asks.should.equal(0);
    });

    it('this.bidPrice and this.askPrice return undefined if input value is undefined, irregardless of integer or ignoreBudgetConstraint settings',
       function(){
	   var intflag, ignoreflag;
	   var flags = [[0,0],[0,1],[1,0],[1,1]];
	   flags.forEach(function(f){
	       var a = new KaplanSniperAgent({minPrice:10, maxPrice:90, ignoreBudgetConstraint:f[0], integer:f[1]});
	       assert.ok(typeof(a.bidPrice())==='undefined');
	       assert.ok(typeof(a.askPrice())==='undefined');
	   });
       });

    it('this.bidPrice and this.askPrice should throw on valid input if special getter functions do not exist', function(){
	var call_bidPrice_with_no_getters = function(){
	    var a = new KaplanSniperAgent({minPrice:10, maxPrice:90});
	    var p = a.bidPrice(50);
	};
	var call_askPrice_with_no_getters = function(){
	    var a = new KaplanSniperAgent({minPrice:10, maxPrice:90});
	    var p = a.askPrice(60);
	};
	call_bidPrice_with_no_getters.should.throw();
	call_askPrice_with_no_getters.should.throw();
    });

    it('.bidPrice is undefined if currentAsk undefined', function(){
	for(var i=1,l=100;i<l;++i)
	    testKaplanSniperAgent({},
				  {
				      currentBidPrice: 10,
				      juicyAskPrice: 40
				  },
				  "bidPrice",
				  i,
				  undefined);
    });

    it('.bidPrice(MV) equals currentAsk===50 iff 50<=juicyAskPrice and 50<=MV',function(){
	var shouldBe50;
	for(var marginalValue=1;marginalValue<100;++marginalValue)
	    for(var juicyAskPrice=1;juicyAskPrice<100;++juicyAskPrice){
		shouldBe50 = (50<=juicyAskPrice) && (50<=marginalValue);
		testKaplanSniperAgent({},
				      {
					  currentAskPrice: 50,
					  juicyAskPrice: juicyAskPrice
				      },
				      "bidPrice",
				      marginalValue,
				      (shouldBe50? 50: undefined)
				     );
	    }
    }); 

    it(".bidPrice(MV) equals currentAsk===50 iff spread <= desiredSpread and 50<=MV", function(){
	var cBid,dSpread,MV;
	for(cBid=1;cBid<50;cBid++)
	    for(dSpread=1;dSpread<40;dSpread++)
		for(MV=40;MV<60;MV++)
		    testKaplanSniperAgent(
			{
			    desiredSpread: dSpread
			},
			{
			    currentBidPrice: cBid,
			    currentAskPrice: 50
			},
			"bidPrice",
			MV,
			( ((MV>=50) && ((50-cBid)<=dSpread))? 50: undefined)
		    );			
    });

    it('.askPrice is undefined if currentBid undefined', function(){
	var a = new KaplanSniperAgent();
	var market = {
	    currentBidPrice: function(){},
	    currentAskPrice: function(){ return 70; }
	};
	a.getJuicyBidPrice = function(){ return 150; };
	for(var i=1,l=100;i<l;++i)
	    assert(typeof(a.askPrice(i, market))==='undefined');
    });

    it('.askPrice(MC) equals currentBid===60 iff juicyBidPrice>=60 and MC<=60',function(){
	var shouldBe60;
	for(var marginalCost=1;marginalCost<100;++marginalCost)
	    for(var juicyBidPrice=1;juicyBidPrice<100;++juicyBidPrice){
		shouldBe60 = (juicyBidPrice<=60) && (marginalCost<=60);
		testKaplanSniperAgent({},
				      {
					  currentBidPrice: 60,
					  juicyBidPrice: juicyBidPrice
				      },
				      "askPrice",
				      marginalCost,
				      (shouldBe60? 60: undefined)
				     );
	    }
    }); 

    it('.askPrice(MC) equals currentBid iff spread <= desiredSpread and MC<= currentBid', function(){
	for(var currentBid=55;currentBid<65;currentBid++)
	    for(var currentAsk=currentBid+1; currentAsk<(currentBid+30); currentAsk++)
		for(var desiredSpread=1; desiredSpread<15; desiredSpread++)
		    for(var mc=50; mc<70; mc++)
			testKaplanSniperAgent(
			    {
				desiredSpread: desiredSpread
			    },
			    {
				currentBidPrice: currentBid,
				currentAskPrice: currentAsk,
				juicyBidPrice: 200,
				juicyAskPrice: 10
			    },
			    "askPrice",
			    mc,
			    ( ((mc<=currentBid) && ((currentAsk-currentBid)<=desiredSpread))? currentBid: undefined)
			);
    });

    
    
});
    
describe('new Pool', function(){
    it('new Pool() initially has no agents', function(){
	var myPool = new Pool();
	myPool.agents.should.deepEqual([]);
    });

    it('pool with no agents, .syncRun returns normally, no error', function(){
	var myPool = new Pool();
	myPool.syncRun(1000);
    });

    it('pool with no agents, .run(1000,cb) calls cb(false) normally, no error', function(done){
	var cb = function(error){
	    assert.ok(!error);
	    done();
	};
	var myPool = new Pool();
	myPool.run(1000,cb);
    });

    it('should not accept invalid agents:  pool.push(a) should throw an error if a is not Agent-related', function(){
	var myPool = new Pool();
	var do_not_do_this = function(){
	    myPool.push({});
	};
	do_not_do_this.should.throw();
    });

    it('pool.agentsById has entry for each id from pool.agents', function(){
	var pool = new Pool();
	var i,l;
	for(i=0,l=10;i<l;i++)
	    pool.push(new Agent());
	pool.agents.length.should.equal(10);
	pool.agents.forEach(function(A){
	    assert.ok(pool.agentsById[A.id]===A);
	});
    });

    it('pool.run(1000) with omitted callback function should throw an error', function(){
	var myPool = new Pool();
	myPool.push(new Agent());
	var do_not_do_this = function(){
	    myPool.run(1000); // callback function intentionally omitted
	}
	do_not_do_this.should.throw();
    });

    it('pool.initPeriod with 2 agents in pool calls .initPeriod on each agent', function(){
	var myPool = new Pool();
	var agent0 = new Agent();
	var agent1 = new Agent();
	agent0.period.number.should.equal(0);
	agent1.period.number.should.equal(0);
	myPool.push(agent0);
	myPool.push(agent1);
	myPool.agents[0].period.number.should.equal(0);
	myPool.agents[1].period.number.should.equal(0);
	myPool.initPeriod({number:1234, startTime:10000});
	myPool.agents[0].period.number.should.equal(1234);
	myPool.agents[1].period.number.should.equal(1234);
    });

    it('pool.initPeriod({number:5, startTime:50000}) sets all period numbers to 5, all wakeTime>50000', function(){
	var myPool = new Pool();
	var agent0 = new Agent();
	var agent1 = new Agent();
	agent0.period.number.should.equal(0);
	agent1.period.number.should.equal(0);
	myPool.push(agent0);
	myPool.push(agent1);
	myPool.initPeriod({number:5, startTime:50000});
	myPool.agents.length.should.equal(2);
	myPool.agents.forEach(function(A){
	    A.period.number.should.equal(5);
	    A.wakeTime.should.be.above(50000);
	});
    });

    it('pool.initPeriod(5) sets all period numbers to 5, startTime to 5000, endTime to 6000, pool.endTime() yields 6000', function(){
	var myPool = new Pool();
	var agent0 = new Agent();
	var agent1 = new Agent();
	agent0.period.number.should.equal(0);
	agent1.period.number.should.equal(0);
	myPool.push(agent0);
	myPool.push(agent1);
	myPool.initPeriod(5);
	myPool.agents.length.should.equal(2);
	myPool.agents.forEach(function(A){
	    A.period.number.should.equal(5);
	    A.period.startTime.should.equal(5000);
	    A.period.endTime.should.equal(6000);
	});
	myPool.endTime().should.equal(6000);
    });

    it("pool.initPeriod([{number:1, init:{color:'blue'}},{number:1, init:{color:'red'}}]) with 3 agents in pool sets agents colors to blue, red, blue and all period numbers to 1", function(){
	var myPool = new Pool();
	[1,2,3].forEach(function(){ myPool.push( new Agent() ); });
	myPool.initPeriod([
	    {number:1, init: {color:'blue'}},
	    {number:1, init: {color:'red'}}
	]);
	myPool.agents[0].period.number.should.equal(1);
	myPool.agents[1].period.number.should.equal(1);
	myPool.agents[2].period.number.should.equal(1);
	myPool.agents[0].color.should.equal('blue');
	myPool.agents[1].color.should.equal('red');
	myPool.agents[2].color.should.equal('blue');
    }); 

    it('pool.endPeriod with 2 agents in pool calls .endPeriod on each agent', function(){
	var myPool = new Pool();
	var agent0 = new Agent();
	var agent1 = new Agent();
	myPool.push(agent0);
	myPool.push(agent1);
	var ended = [0,0];
	var handler = function(i){ return function(){ ended[i]=1; }; };
	agent0.on('post-period', handler(0));
	agent1.on('post-period', handler(1));
	myPool.endPeriod();
	ended.should.deepEqual([1,1]);
    });

    var poolAgentRateTest = function(rates, agentFunc, done){
	var async = (typeof(done)==='function');
	var numberOfAgents = rates.length;
	var i;
	var cb;
	var wakes = new Array(numberOfAgents).fill(0);
	var expected = rates.map(function(r){ return 1000*r; });
	var checkWakes = function(){
	    wakes.forEach(function(wakeCount, i){
		wakeCount.should.be.within(expected[i]-5*Math.sqrt(expected[i]), expected[i]+5*Math.sqrt(expected[i]));
	    });
	};
	var incWakeFunc = function(i){ return function(){ wakes[i]++; }; };
	var myAgent;
	var myPool = new Pool();
	for(i=0;i<numberOfAgents;++i){
	    myAgent = new agentFunc({rate: rates[i]});
	    myAgent.on('wake', incWakeFunc(i));
	    myPool.push(myAgent);
	}
	if (async){
	    cb = function(error){
		if (error)
		    throw new Error("pool should not throw error");
		checkWakes();
		done();
	    };
	    myPool.run(1000, cb, 53);
	    /* previous line should return immediately, before event loop runs, so wakeCounts are zero */
	    wakes.forEach(function(wakeCount, i){ wakeCount.should.equal(0); });
	} else {
	    myPool.syncRun(1000);
	    checkWakes();
	}
    };
    
    it('pool with one agent, rate 1, wakes about 1000 times with .syncRun(1000) ', function(){
	poolAgentRateTest([1],Agent);
    });

    it('pool with one agent, rate 1, wakes about 1000 times with .Run(1000) ', function(done){
	poolAgentRateTest([1],Agent,done);
    });

    it('pool with ten agents, rate 1, wakes about 1000 times each with .syncRun(1000) ', function(){
	poolAgentRateTest(new Array(10).fill(1), Agent);
    });

    it('pool with ten agents, rate 1, wakes about 1000 times each with .Run(1000) ', function(done){
	poolAgentRateTest(new Array(10).fill(1), Agent, done);
    });

    it('pool with ten agents, rates [1,2,3,4,5,6,7,8,9,10] wakes about [1000,2000,...,10000] times each with .syncRun(1000) ', function(){
	poolAgentRateTest([1,2,3,4,5,6,7,8,9,10], Agent);
    });

    it('pool with ten agents, rates [1,2,3,4,5,6,7,8,9,10], wakes about [1000,2000,...,10000] times each with .Run(1000) ', function(done){
	poolAgentRateTest([1,2,3,4,5,6,7,8,9,10], Agent, done);
    });

    it('pool with one zi Agent, rate 2, wakes about 2000 times with .syncRun(1000) ', function(){
	poolAgentRateTest([2],ziAgent);
    });

    it('pool with one zi agent, rate 2, wakes about 2000 times with .Run(1000) ', function(done){
	poolAgentRateTest([2],ziAgent,done);
    });

    it('pool with 100 zi agents, rates [0.01,...,1], wakes about [10,20,...,1000] times each with .syncRun(1000)', function(){
	var i,l
	var rates=[];
	for(i=0,l=100; i<l; ++i)
	    rates[i] = (1+i)/100;
	poolAgentRateTest(rates, ziAgent);
    });

    it('pool with 100 KaplanSniper agents, rates [0.1,0.11,...,1.09], check behavior for correct end-of-period sniping', function(){
	var agentBidLog=[];
	var agentAskLog=[];
	var bidCount = 0, askCount = 0;
	var currentBid=40, currentAsk=60;
	var i=0,A=[];
	for(i=0;i<100;++i){
	    agentBidLog[i]=[];
	    agentAskLog[i]=[];
	}
	var myPool = new Pool();
	var market =  {
	    goods: "X",
	    currentBidPrice: function(){ return currentBid; },
	    currentAskPrice: function(){ return currentAsk; }
	};
	var getJuicyBidPrice = function(){ return 101; };
	var getJuicyAskPrice = function(){ return 1; };
	var ask = function(market, price){ 
	    askCount++;
	    market.goods.should.equal("X");
	    price.should.equal(currentBid);
	    this.unitCostFunction("X",this.inventory).should.be.within(0, currentBid);
	    agentAskLog[this.id].push(this.wakeTime);
	};
	var bid = function(market, price){
	    bidCount++;
	    market.goods.should.equal("X");
	    price.should.equal(currentAsk);
	    this.unitValueFunction("X",this.inventory).should.be.within(currentAsk, 100);
	    agentBidLog[this.id].push(this.wakeTime);
	};
	    
	for(i=1;i<50;i++){
	    A[i] = new KaplanSniperAgent(
		{
		    id: i,
		    desiredSpread:8,
		    rate: (i+9.0)/100.0,
		    inventory: {'X':0, 'money':1000},
		    markets: [market],
		    costs: {'X': [2*i+1] }
		}
	    );
	    A[i].getJuicyBidPrice = getJuicyBidPrice;
	    A[i].getJuicyAskPrice = getJuicyAskPrice;
	    A[i].bid = bid;
	    A[i].ask = ask;
	    A[i].id.should.equal(i);
	    myPool.push(A[i]);
	}
	for(i=50;i<100;i++){
	    A[i] = new KaplanSniperAgent(
		{
		    id: i,
		    desiredSpread: 8,
		    rate: (i+9.0)/100.0,
		    inventory: {'X':0, 'money': 1000},
		    markets: [market],
		    values: {'X': [2*(i-50)+1]}
		}
	    );
	    A[i].getJuicyBidPrice = getJuicyBidPrice;
	    A[i].getJuicyAskPrice = getJuicyAskPrice;
	    A[i].bid = bid;
	    A[i].ask = ask;
	    A[i].id.should.equal(i);
	    myPool.push(A[i]);
	}
	
	myPool.initPeriod({number:1, startTime: 1000, endTime: 2000});
	myPool.syncRun(2000);
	/* bidCount,askCount actually should be around 3x 20 = 60, but random, and want a test that will not fail often */
	bidCount.should.be.above(20, 'not enough bids:'+bidCount);
	askCount.should.be.above(20, 'not enough asks:'+askCount);
	/* below we test that no bids or asks were earlier than the end-of-period rate-based snipe activation time */
	/* and that no agent switched roles, i.e. no buyers were asking, no sellers were bidding */
	agentAskLog.forEach(function(L,j){
	    if (j===0) return;
	    if (j<50){ 
		var minT = 2000-(3.0/A[j].rate);
		L.forEach(function(tAsk){ 
		    tAsk.should.be.above(minT);
		});
	    } else {
		L.length.should.equal(0);
	    }
	});
	agentBidLog.forEach(function(L,j){
	    if (j===0) return;
	    if (j<50){ 
		L.length.should.equal(0); 
	    } else {
		var minT = 2000-(3.0/A[j].rate);
		L.forEach(function(tBid){ 
		    tBid.should.be.above(minT);
		});
	    } 
	});
	
    });

    it('pool with 10 generic agents, pool.Trade agent 0 buys 1 X@400 from agent 5, correct inventories',
       function(){
	   var i,l;
	   var pool = new Pool();
	   for(i=0,l=10;i<l;++i)
	       pool.push(new Agent({inventory:{'X':0, 'money':1000}}));
	   pool.agents.forEach(function(A){
	       A.inventory.X.should.equal(0);
	       A.inventory.money.should.equal(1000);
	   });
	   var tradeSpec = {
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
	   pool.agents.forEach(function(A,i){ 
	       if (i===0){
		   A.inventory.X.should.equal(1);
		   A.inventory.money.should.equal(600);
	       } else if (i===5){
		   A.inventory.X.should.equal(-1);
		   A.inventory.money.should.equal(1400);
	       } else {
		   A.inventory.X.should.equal(0);
		   A.inventory.money.should.equal(1000);
	       }
	   });
       });;

    it('pool with 10 agents, pool.Trade agent 0 buys 1 X@400 from agent 5, 1 X@450 from agent 6, correct inventories',
       function(){
	   var i,l;
	   var pool = new Pool();
	   for(i=0,l=10;i<l;++i)
	       pool.push(new Agent({inventory:{'X':0, 'money':1000}}));
	   pool.agents.forEach(function(A){
	       A.inventory.X.should.equal(0);
	       A.inventory.money.should.equal(1000);
	   });
	   var tradeSpec = {
	       bs: 'b',
	       goods: 'X',
	       money: 'money',
	       buyQ: [2],
	       sellQ: [1,1],
	       buyId: [pool.agents[0].id],
	       sellId: [pool.agents[5].id,pool.agents[6].id],
	       prices: [400,450]
	   };
	   pool.trade(tradeSpec);
	   pool.agents.forEach(function(A,i){ 
	       if (i===0){
		   A.inventory.X.should.equal(2);
		   A.inventory.money.should.equal(150);
	       } else if (i===5){
		   A.inventory.X.should.equal(-1);
		   A.inventory.money.should.equal(1400);
	       } else if (i===6){
		   A.inventory.X.should.equal(-1);
		   A.inventory.money.should.equal(1450);
	       } else {
		   A.inventory.X.should.equal(0);
		   A.inventory.money.should.equal(1000);
	       }
	   });
       });;

    it('pool with 10 agents, pool.Trade agent 2 sells 1 X@175 to agent 6, correct inventories',
       function(){
	   var i,l;
	   var pool = new Pool();
	   for(i=0,l=10;i<l;++i)
	       pool.push(new Agent());
	   pool.agents.forEach(function(A){
	       A.inventory.should.deepEqual({'money':0});
	   });
	   var tradeSpec = {
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
	   pool.agents.forEach(function(A,i){ 
	       if (i===2){
		   A.inventory.X.should.equal(-1);
		   A.inventory.money.should.equal(175);
	       } else if (i===6){
		   A.inventory.X.should.equal(1);
		   A.inventory.money.should.equal(-175);
	       } else {
		   A.inventory.should.deepEqual({money:0});
	       }
	   });
       });;

    it('pool with 10 agents, pool.Trade agent 2 sells 1 X@175 to agent 6, 2 X@150 to agent 4, correct inventories',
       function(){
	   var i,l;
	   var pool = new Pool();
	   for(i=0,l=10;i<l;++i)
	       pool.push(new Agent());
	   pool.agents.forEach(function(A){
	       A.inventory.should.deepEqual({money:0});
	   });
	   var tradeSpec = {
	       bs: 's',
	       goods: 'X',
	       money: 'money',
	       buyQ: [1,2],
	       sellQ: [3],
	       buyId: [pool.agents[6].id, pool.agents[4].id],
	       sellId: [pool.agents[2].id],
	       prices: [175, 150]
	   };
	   pool.trade(tradeSpec);
	   pool.agents.forEach(function(A,i){ 
	       if (i===2){
		   A.inventory.X.should.equal(-3);
		   A.inventory.money.should.equal(475);
	       } else if (i===4){
		   A.inventory.X.should.equal(2);
		   A.inventory.money.should.equal(-300);
	       } else if (i===6){
		   A.inventory.X.should.equal(1);
		   A.inventory.money.should.equal(-175);
	       } else {
		   A.inventory.should.deepEqual({money:0});
	       }
	   });
       });;

    var badTradeTest = function(bs, invalidSum){
	var i,l;
	var pool = new Pool();
	for(i=0,l=10;i<l;++i)
	    pool.push(new Agent());
	pool.agents.forEach(function(A){
	    A.inventory.should.deepEqual({money:0});
	});
	var tradeSpec = {
	    bs: bs,
	    goods: 'X',
	    money: 'money',
	    buyQ: [2,2],
	    sellQ: [2,2],
	    buyId: [pool.agents[6].id, pool.agents[4].id],
	    sellId: [pool.agents[2].id, pool.agents[3].id],
	    prices: [175, 150]
	};
	if (invalidSum){
	    if (bs==='b'){
		tradeSpec.buyId = tradeSpec.buyId.slice(0,1);
		tradeSpec.buyQ = [3];
	    } else {
		tradeSpec.sellId = tradeSpec.sellId.slice(0,1);
		tradeSpec.sellQ = [3];
	    }
	}
	var do_not_do_this = function(){
	    pool.trade(tradeSpec);
	};
	do_not_do_this.should.throw();
	pool.agents.forEach(function(A){
	    A.inventory.should.deepEqual({money:0});
	});
    };

    it('pool.trade throws error on bad buy trade with multiple tradeSpec.buyId entries, inventories unchanged',
       function(){
	   badTradeTest('b');
       });

    it('pool.trade throws error on bad buy trade with buyQ[0] sum not equal to sum over i of sellQ[i], inventories unchanged',
       function(){
	   badTradeTest('b',true);
       });

    it('pool.trade throws error on bad sell trade with multiple tradeSpec.sellId entries, inventories unchanged',
       function(){
	   badTradeTest('s');
       });

    it('pool.trade throws error on bad sell trade with sellQ[0] sum not equal to sum over i of buyQ[i], inventories unchanged',
       function(){
	   badTradeTest('s',true);
       });

    it("pool.distribute('values','X',[100,80,60,50,40,30,20,10]) over 5 agents",function(){
	var myPool = new Pool();
	[1,2,3,4,5].forEach(function(){myPool.push(new Agent); });
	myPool.distribute('values','X',[100,80,60,50,40,30,20,10]);
	myPool.agents[0].values.X.should.deepEqual([100,30]);
	myPool.agents[1].values.X.should.deepEqual([80,20]);
	myPool.agents[2].values.X.should.deepEqual([60,10]);
	myPool.agents[3].values.X.should.deepEqual([50]);
	myPool.agents[4].values.X.should.deepEqual([40]);	
    });

    it("pool.distribute('values','X',' 100,80,60,50,40,30 20,  10   ') over 5 agents",function(){
	var myPool = new Pool();
	[1,2,3,4,5].forEach(function(){myPool.push(new Agent); });
	myPool.distribute('values','X'," 100,80,60,50,40,30 20,  10   ");
	myPool.agents[0].values.X.should.deepEqual([100,30]);
	myPool.agents[1].values.X.should.deepEqual([80,20]);
	myPool.agents[2].values.X.should.deepEqual([60,10]);
	myPool.agents[3].values.X.should.deepEqual([50]);
	myPool.agents[4].values.X.should.deepEqual([40]);	
    });


    it("pool.distribute('values','X',[100,80,60,50,40,30,20,10]) over 10 agents",function(){
	var myPool = new Pool();
	[1,2,3,4,5,6,7,8,9,10].forEach(function(){myPool.push(new Agent); });
	myPool.distribute('values','X',[100,80,60,50,40,30,20,10]);
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
});
