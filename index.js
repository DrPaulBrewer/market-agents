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
	this.emit('pre-transfer', myTransfers);
	goods = Object.keys(myTransfers);
	for(i=0,l=goods.length; i<l; ++i){
	    if (this.inventory[goods[i]])
		this.inventory[goods[i]] += myTransfers[goods[i]];
	    else
		this.inventory[goods[i]] = myTransfers[goods[i]];
	}
	this.emit('post-transfer', myTransfers);
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
    this.agentsById = {};
};

Pool.prototype.push = function(agent){
    if (!this.agentsById[agent.id]){
	this.agents.push(agent);
	this.agentsById[agent.id] = agent;
    }
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

Pool.prototype.initPeriod = function(period, info){
    var i,l;
    for(i=0,l=this.agents.length; i<l; i++)
	this.agents[i].initPeriod(period, info);
};

Pool.prototype.endPeriod = function(info){
    var i,l;
    for(i=0,l=this.agents.length;i<l;i++)
	this.agents[i].endPeriod(info);
};

var sum = function(a){
    var i,l,total=0;
    for(i=0,l=a.length;i<l;++i)
	total += a[i];
    return total;
};

var dot = function(a,b){
    var i,l,total=0;
    if (a.length!==b.length)
	throw new Error("vector dimensions do not match in dot(a,b)");
    for(i=0,l=a.length;i<l;++i)
	if (b[i])
	    total += a[i]*b[i];
    return total;
};

Pool.prototype.trade = function(tradeSpec){
    var i,l,buyerTransfer,sellerTransfer,total;
    if (typeof(tradeSpec)!=='object') return;
    if ( (tradeSpec.bs) &&
	 (tradeSpec.goods) &&
	 (tradeSpec.money) &&
	 (Array.isArray(tradeSpec.prices)) && 
	 (Array.isArray(tradeSpec.buyQ)) &&
	 (Array.isArray(tradeSpec.sellQ)) &&
	 (Array.isArray(tradeSpec.buyId)) &&
	 (Array.isArray(tradeSpec.sellId)) ){	
	if (tradeSpec.bs==='b'){
	    if (tradeSpec.buyId.length!==1)
		throw new Error("Pool.trade expected tradeSpec.buyId.length===1, got:"+tradeSpec.buyId.length);
	    if (tradeSpec.buyQ[0] !== sum(tradeSpec.sellQ))
		throw new Error("Pool.trade invalid buy -- tradeSpec buyQ[0] != sum(sellQ)");
	    buyerTransfer = {};
	    buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[0];
	    buyerTransfer[tradeSpec.money] = -dot(tradeSpec.sellQ,tradeSpec.prices);
	    Pool.agentsById[tradeSpec.buyId[0]].transfer(buyerTransfer);
	    for(i=0,l=tradeSpec.prices.length;i<l;++i){
		sellerTransfer = {};
		sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[i];
		sellerTransfer[tradeSpec.money] = tradeSpec.prices[i]*tradeSpec.sellQ[i];
		Pool.agentsById[tradeSpec.sellId[i]].transfer(sellerTransfer);
	    }
	} else if (tradeSpec.bs==='s'){
	    if (tradeSpec.sellId.length!==1)
		throw new Error("Pool.trade expected tradeSpec.sellId.length===1. got:"+tradeSpec.sellId.length);
	    if (tradeSpec.sellQ[0] !== sum(tradeSpec.buyQ))
		throw new Error("Pool.trade invalid sell -- tradeSpec sellQ[0] != sum(buyQ)");
	    sellerTransfer = {};
	    sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[0];
	    sellerTransfer[tradeSpec.money] = dot(tradeSpec.buyQ,tradeSpec.prices);
	    Pool.agentsById[tradeSpec.sellId[0]].transfer(sellerTransfer);
	    for(i=0,l=tradeSpec.prices.length;i<l;++i){
		buyerTransfer = {};
		buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[i];
		buyerTransfer[tradeSpec.money] = -tradeSpec.prices[i]*tradeSpec.buyQ[i];
		Pool.agentsById[tradeSpec.buyId[i]].transfer(buyerTransfer);
	    }
	}
	
    }
};

module.exports = {
    Agent: Agent,
    ziAgent: ziAgent,
    Pool: Pool
};



