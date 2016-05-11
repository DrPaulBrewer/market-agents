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

    it('should have properties Agent, ziAgent, Pool', function(){
	MarketAgents.should.have.properties('Agent','ziAgent','Pool');
    });

});

describe('new Agent', function(){
    it('should have properties id, description, inventory, endowment, wakeTime, rate, nextWake, period with proper types',
       function(){ 
	   var myAgent = new Agent();
	   myAgent.should.be.type('object');
	   myAgent.should.have.properties('id','description','inventory','endowment','wakeTime','rate','nextWake','period');
	   myAgent.id.should.be.type('number');
	   myAgent.description.should.be.type('string');
	   myAgent.inventory.should.be.type('object');
	   myAgent.endowment.should.be.type('object');
	   myAgent.wakeTime.should.be.type('number');
	   myAgent.rate.should.be.type('number');
	   myAgent.nextWake.should.be.type('function');
	   myAgent.period.should.be.type('number');
       });
    
    it('should have ascending default id number', function(){
	var agent1 = new Agent();
	var agent2 = new Agent();
	assert.ok(agent1.id>0);
	assert.ok(agent2.id>0);
	assert.ok(agent2.id>agent1.id);
    });
    
    it('test 1000 wakes, should have ascending wake times', function(){
	var agent = new Agent();
	var i,l;
	var t0,t1;
	var wakes = 0;
	agent.on('wake',function(){ wakes++; });
	for(i=0,l=1000;i<l;i++){
	    t0 = agent.wakeTime;
	    agent.wake();
	    t1 = agent.wakeTime;
	    assert.ok(t1>t0);
	}
	assert.ok(wakes===1000);
    });

    it('test 1000 wakes, agent with rate 2 should use between 1/3 and 2/3 the time of agent with rate 1', function(){
	var agent1 = new Agent();
	var agent2 = new Agent({rate: 2});
	var i,l;
	var wakes1=0, wakes2=0;
	agent1.on('wake', function(){ wakes1++; });
	agent2.on('wake', function(){ wakes2++; });
	for(i=0,l=1000;i<l;++i){
	    agent1.wake();
	    agent2.wake();
	}
	assert.ok(wakes1===1000);
	assert.ok(wakes2===1000);
	assert.ok(agent2.wakeTime>(0.33*agent1.wakeTime));
	assert.ok(agent2.wakeTime<(0.67*agent1.wakeTime));	
    });

    it('agent.getPeriodNumber() should initially return 0', function(){
	var agent = new Agent();
	agent.getPeriodNumber().should.equal(0);
    });
    
    describe('agent-period cycle interactions with numeric period', function(){
	function setup(){
	    var someMoneyNoX = {money: 1000, X:0};
	    var agent0 = new Agent({endowment: someMoneyNoX});
	    var agent1 = new Agent({endowment: someMoneyNoX});
	    return [agent0, agent1];
	}
	it('should initially be at period 0', function(){
	    var agents = setup();
	    agents[0].getPeriodNumber().should.equal(0);
	    agents[1].getPeriodNumber().should.equal(0);
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
	    assert.ok(agents[0].endowment.X===0);
	    assert.ok(agents[0].endowment.money===1000);
	    assert.ok(agents[1].inventory.X===0);
	    assert.ok(agents[1].inventory.money===1000);
	});
	it('agents should indicate period 1 when set', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    agents.forEach(function(a){ a.initPeriod(1) });
	    assert.ok(agents[0].getPeriodNumber()===1);
	    assert.ok(agents[1].getPeriodNumber()===1);
	});
	it('agents 1,2, should show initial inventory 0 X, 1000 Money for Period 1', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    agents.forEach(function(a){ a.initPeriod(1) });
	    assert.ok(agents[0].inventory.X===0);
	    assert.ok(agents[0].inventory.money===1000);
	    assert.ok(agents[1].inventory.X===0);
	    assert.ok(agents[1].inventory.money===1000);
	});
	it('agent 1 given 2Y should still have 2Y after period reset as Y amount unspecified in endowment', function(){
	    var agents = setup();
	    var give1Y = {Y:1};
	    agents[0].transfer(give1Y);
	    assert.ok(agents[0].inventory.Y===1);
	    agents.forEach(function(a){a.initPeriod(1) });
	    assert.ok(agents[0].inventory.X===0);
	    assert.ok(agents[0].inventory.money===1000);
	    assert.ok(agents[0].inventory.Y===1);
	    assert.ok(agents[1].inventory.X===0);
	    assert.ok(agents[1].inventory.money===1000);
	});

    });

});
    
describe('new ziAgent', function(){
    it('should have properties id, description, inventory, endowment, wakeTime, rate, nextWake, period with proper types',
       function(){ 
	   var myAgent = new ziAgent();
	   myAgent.should.be.type('object');
	   myAgent.should.have.properties('id','description','inventory','endowment','wakeTime','rate','nextWake','period');
	   myAgent.id.should.be.type('number');
	   myAgent.description.should.be.type('string');
	   myAgent.inventory.should.be.type('object');
	   myAgent.endowment.should.be.type('object');
	   myAgent.wakeTime.should.be.type('number');
	   myAgent.rate.should.be.type('number');
	   myAgent.nextWake.should.be.type('function');
	   myAgent.period.should.be.type('number');
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
	var zi = new ziAgent();
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
	var zi = new ziAgent({markets: {X:1}, endowment: {coins:0, X:0, Y:0}, values: {X: [100]}});
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(good, p){ 
	    assert.ok(good==='X');
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
	var zi = new ziAgent({markets: {X:1}, endowment: {coins:0, X:0, Y:0}, costs: {X: [100]}, maxPrice:1000});
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(good, p){ 
	    bids++; 
	};
	zi.ask = function(good,p){ 
	    good.should.equal('X');
	    p.should.be.within(100,1000);
	    asks++; 
	};
	zi.wake();
	wakes.should.equal(1);
	bids.should.equal(0);
	asks.should.equal(1);	
    });

    it('should call this.bid() and this.ask() on this.wake() if both values and  costs configured', function(){
	var zi = new ziAgent({
	    endowment: {coins:0, X:0, Y:0},
	    markets: {X:1,Y:1}, 
	    costs: {X: [100]}, 
	    values: {Y: [50]},
	    maxPrice:1000
	});
	var wakes=0,bids=0,asks=0;
	zi.on('wake', function(){ wakes++; });
	zi.bid = function(good, p){ 
	    bids++; 
	    good.should.equal('Y');
	    p.should.be.within(0,100);
	};
	zi.ask = function(good,p){ 
	    good.should.equal('X');
	    p.should.be.within(50,1000);
	    asks++; 
	};
	zi.wake();
	wakes.should.equal(1);
	bids.should.equal(1);
	asks.should.equal(1);	
    });    

    it('10000 tests this.bidPrice(v) should return number  between minPrice and v', function(){
	var zi = new ziAgent();
	var i,l,p;
	for(i=1,l=10000; i<l; i++){
	    p = zi.bidPrice(i);
	    p.should.be.within(0,i);
	    Math.floor(p).should.not.equal(p);
	}
	zi.integer = true;
	zi.minPrice = 1;
	for(i=1,l=10000; i<l; i++){
	    p = zi.bidPrice(i);
	    p.should.be.within(1,i);
	    Math.floor(p).should.equal(p);
	}
    });

    it('10000 tests this.askPrice(c) should return number between c and maxPrice', function(){
	var zi = new ziAgent({maxPrice: 12345});
	var i,l,p;
	for(i=1,l=10000;i<l;i++){
	    p = zi.askPrice(i);
	    p.should.be.within(i,12345);
	    Math.floor(p).should.not.equal(p);
	}
	zi.integer=true;
	zi.maxPrice = 11111;
	for(i=1,l=10000;i<l;++i){
	    p = zi.askPrice(i);
	    p.should.be.within(i,11111);
	    Math.floor(p).should.equal(p);
	}
    });

    it('sample of 10000 this.bidPrice(v=100) chi-square test for uniformity on [0,100) ', function(){
	var zi = new ziAgent({integer: true});
	var i,l,p;
	var bins = new Array(100).fill(0);
	var sumsq = 0;
	var chisq100 = 0;
	var e = 0;
	var norm = 0;
	for(i=1,l=10000; i<l; i++){
	    p = zi.bidPrice(100);
	    p.should.be.within(0,100);
	    bins[p]++;
	}
	for(i=0,l=100;i<l;++i){
	    e = bins[i]-100;
	    sumsq += e*e;
	}
	chisq100=sumsq/100.0;
	norm = (chisq100-100)/Math.sqrt(2*100);
	norm.should.be.within(-5,5);
    });

    it('sample of 10000 this.askPrice(c=50) chi-square test for uniformity on [50,maxPrice=150) ', function(){
	var zi = new ziAgent({integer: true, maxPrice:150});
	var i,l,p;
	var bins = new Array(100).fill(0);
	var sumsq = 0;
	var chisq100 = 0;
	var e = 0;
	var norm = 0;
	for(i=1,l=10000; i<l; i++){
	    p = zi.askPrice(50);
	    p.should.be.within(50,150);
	    bins[p-50]++;
	}
	for(i=0,l=100;i<l;++i){
	    e = bins[i]-100;
	    sumsq += e*e;
	}
	chisq100=sumsq/100.0;
	norm = (chisq100-100)/Math.sqrt(2*100);
	norm.should.be.within(-5,5);
    });
    
});
    
describe('new Pool', function(){
    it('new Pool() initially has no agents', function(){
	var myPool = new Pool();
	myPool.agents.should.deepEqual([]);
    });
    
    it('pool with one agent, rate 1, wakes about 1000 times with .syncRun(1000) ', function(){
	var myPool = new Pool();
	var myAgent = new Agent();
	var wakes = 0;
	myAgent.on('wake', function(){ wakes++; });
	myPool.push(myAgent);
	myPool.syncRun(1000);
	wakes.should.be.within(1000-5.0*Math.sqrt(1000),1000+5.0*Math.sqrt(1000));
    });

    it('pool with one agent, rate 1, wakes about 1000 times with .Run(1000) ', function(done){
	var myPool = new Pool();
	var myAgent = new Agent();
	var wakes = 0;
	var cb = function(exhausted){
	    if (exhausted)
		throw new Error("should not exhaust pool");
	    wakes.should.be.within(1000-5.0*Math.sqrt(1000),1000+5.0*Math.sqrt(1000));
	    done();
	};
	myAgent.on('wake', function(){ wakes++; });
	myPool.push(myAgent);
	myPool.run(1000, cb);
    });

    it('pool with one zi Agent, rate 2, wakes about 2000 times with .syncRun(1000) ', function(){
	var myPool = new Pool();
	var myAgent = new ziAgent({rate:2});
	var wakes = 0;
	myAgent.on('wake', function(){ wakes++; });
	myPool.push(myAgent);
	myPool.syncRun(1000);
	wakes.should.be.within(2000-5.0*Math.sqrt(2000),2000+5.0*Math.sqrt(2000));
    });

    it('pool with one zi agent, rate 2, wakes about 2000 times with .Run(1000) ', function(done){
	var myPool = new Pool();
	var myAgent = new ziAgent({rate:2});
	var wakes = 0;
	var cb = function(exhausted){
	    if (exhausted)
		throw new Error("should not exhaust pool");
	    wakes.should.be.within(2000-5.0*Math.sqrt(2000),2000+5.0*Math.sqrt(2000));
	    done();
	};
	myAgent.on('wake', function(){ wakes++; });
	myPool.push(myAgent);
	myPool.run(1000, cb);
    });

    
});
