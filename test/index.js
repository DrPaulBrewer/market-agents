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

    it('should have properties Agent, ziAgent, Pool', function(){
	MarketAgents.should.have.properties('Agent','ziAgent','Pool');
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

    describe('agent-period cycle interactions', function(){
	function setup(){
	    var someMoneyNoX = {money: 1000, X:0};
	    var period = {number:0, startTime:0, init:{inventory: someMoneyNoX}};
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
	it('agents should indicate period 1 after set with .initPeriod({number:1, ... })', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    agents.forEach(function(a){ a.initPeriod(Object.assign({},a.period,{number:1})); });
	    assert.ok(agents[0].period.number===1);
	    assert.ok(agents[1].period.number===1);
	});
	it('agents should indicate period 1 after set with .initPeriod(1)', function(){
	    var agents = setup();
	    var buyOneXFor500 = {money: -500, X:1 };
	    agents[0].transfer(buyOneXFor500);
	    agents.forEach(function(a){ a.initPeriod(1); });
	    assert.ok(agents[0].period.number===1);
	    assert.ok(agents[1].period.number===1);
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
	var zi = new ziAgent({markets: {X:1}});
	zi.initPeriod({number:0, startTime:0, init: {inventory: {coins:0, X:0, Y:0 }, values: {X: [100,1,1]}}});
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
	var zi = new ziAgent({markets: {X:1}});
	zi.initPeriod({number:0, startTime:0, init: {inventory: {coins:0, X:0, Y:0 }, costs: {X: [100,1000,1000]}}});
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
	    inventory: {coins:0, X:0, Y:0},
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
	for(i=1,l=10000;i<l;i++){
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

    it('pool.initPeriod(5) sets all period numbers to 5', function(){
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
	});
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
	    cb = function(exhausted){
		if (exhausted)
		    throw new Error("should not exhaust pool");
		checkWakes();
		done();
	    };
	    myPool.run(1000, cb);
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

    it('pool with 10 agents, pool.Trade agent 0 buys 1 X@400 from agent 5, correct inventories',
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



    

});
