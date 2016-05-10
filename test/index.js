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
