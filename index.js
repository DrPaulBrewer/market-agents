/* jshint esnext:true */

const util = require('util');
const EventEmitter = require('events').EventEmitter;
const RandomJS = require('random-js');
const ProbJS = require('prob.js');


var _nextId = 1;
function nextId(){ return _nextId++; }

function neverWake(){ return 0; }

function poissonWake(){
    var delta = ProbJS.exponential(this.rate)();
    return this.wakeTime+delta;
}

var Agent = function(options){
    EventEmitter.call(this);
    var defaults = {
	id: nextId(),
	description: 'default do nothing agent',
	inventory: {},
	endowment: {},
	wakeTime: 0,
	rate: 1,
	period: 0,
	nextWake: poissonWake
    };
    Object.assign(this, defaults, options);
    this.init();
};

util.inherits(Agent, EventEmitter);

Agent.prototype.getPeriodNumber = function(){
    if (typeof(this.period)==='number') return this.period;
    if (typeof(this.period)==='object') return this.period.number;
};
    
Agent.prototype.resetInventory = function(newInventory){
    var amounts = newInventory || this.endowment;
    var goods;
    var i,l,g;
    if (Array.isArray(amounts))
	amounts = amounts[this.getPeriodNumber()];
    if (typeof(amounts)==='function')
	amounts = amounts.call(this);
    if (typeof(amounts)==='object'){
	goods = Object.keys(amounts);
	for(i=0,l=goods.length;i<l;++i){
	    g = goods[i];
	    this.inventory[g] = amounts[g];
	}
    }
};

Agent.prototype.init = function(){
    this.resetInventory();
    this.wakeTime = this.nextWake();
};

Agent.prototype.initPeriod = function(period, info){
    this.period = period;
    this.wakeTime = (typeof(period)==='object')? (period.startTime): 0;
    this.init();
    this.emit('initPeriod', info);
};

Agent.prototype.endPeriod = function(info){
    this.emit('endPeriod', info);
};

Agent.prototype.wake = function(info){
    this.emit('wake', info);
    this.wakeTime = this.nextWake();
};

Agent.prototype.transfer = function(myTransfers){
    var goods, i, l;
    if (myTransfers){
	goods = Object.keys(myTransfers);
	for(i=0,l=goods.length; i<l; ++i){
	    if (this.inventory[goods[i]])
		this.inventory[goods[i]] += myTransfers[goods[i]];
	    else
		this.inventory[goods[i]] = myTransfers[goods[i]];
	}
    }
};

ziAgent = function(options){
    // from an idea developed by Gode and Sunder in a series of economics papers
    var defaults = {
	description: 'Gode and Sunder style ZI Agent',
	markets: {},
	values: {},
	costs: {},
	minPrice: 0,
	maxPrice: 1000
    };
    Agent.call(this, Object.assign({}, defaults, options));
    this.on('wake', function(){
	this.sendBidsAndAsks();
    });
}; 

util.inherits(ziAgent, Agent);

ziAgent.prototype.sendBidsAndAsks = function(){
    var names = Object.keys(this.markets);
    var i,l;
    var vals, costs;
    var unitValue, unitCost;
    var good;
    var myPrice;
    for(i=0,l=names.length;i<l;++i){
	good = names[i];
	vals = this.values[good];
	costs = this.costs[good];
	if (Array.isArray(vals) && (vals.length>0) && (this.inventory[good]>=0)){
	    unitValue = vals[this.inventory[good]];
	    if (unitValue>0){
		myPrice = this.bidPrice(unitValue);
		this.bid(good, myPrice);
	    }
	}
	if (Array.isArray(costs) && (costs.length>0) && (this.inventory[good]<=0)){
	    unitCost = costs[-this.inventory[good]];
	    if (unitCost>0){
		myPrice = this.askPrice(unitCost);
		this.ask(good, myPrice);
	    }
	}
    }
};

ziAgent.prototype.bidPrice = function(value){
    var p = ProbJS.uniform(this.minPrice, value)();
    if (this.integer) p = Math.floor(p);
    return p;
};

ziAgent.prototype.askPrice = function(cost){
    var p = ProbJS.uniform(cost, this.maxPrice)();
    if (this.integer) p = Math.floor(p);
    return p;
};

Pool = function(){
    this.agents = [];
};

Pool.prototype.push = function(agent){
    this.agents.push(agent);
};

Pool.prototype.next = function(){
    var tMin=1e20, i=0, l=this.agents.length, A=this.agents, t=0, result=0;
    for(; i<l; i++){
	t = A[i].wakeTime;
	if ( (t>0) && (t<tMin) ){
	    result = A[i];
	    tMin = t;
	}
    }
    return result;
};

var hasSetImmediate = false;
try { setImmediate(function(){ hasSetImmediate=true; }); } catch(e){}

Pool.prototype.run = function(untilTime, cb){
    /* note: setTimeout slows this down significnatly if setImmediate is not available */
    var that = this;
    if (typeof(cb)!=='function')
	throw new Error("Pool.run: Callback function undefined");
    var loop = function(){
	var nextAgent = that.next();
	if (!nextAgent) return cb.call(that, true);
	var tNow = nextAgent.wakeTime;
	if (tNow > untilTime){
	    return cb.call(that, false);
	} else {
	    nextAgent.wake();
	    if (hasSetImmediate) setImmediate(loop);
	    else setTimeout(loop,0);
	}
    };
    if (hasSetImmediate) setImmediate(loop);
    else setTimeout(loop,0);
};

Pool.prototype.syncRun = function(untilTime){
    var nextAgent = this.next();
    while (nextAgent.wakeTime < untilTime){
	nextAgent.wake();
	nextAgent = this.next();
    }
};
    
Pool.prototype.settleTrades = function(tradeSpec){
};

module.exports = {
    Agent: Agent,
    ziAgent: ziAgent,
    Pool: Pool
};



