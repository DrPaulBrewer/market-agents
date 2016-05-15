/* jshint esnext:true */

const util = require('util');
const EventEmitter = require('events').EventEmitter;
const RandomJS = require('random-js');
const ProbJS = require('prob.js');


var _nextId = 1;
function nextId(){ return _nextId++; }

function poissonWake(){
    var delta = ProbJS.exponential(this.rate)();
    return this.wakeTime+delta;
}

var Agent = function(options){
    EventEmitter.call(this);
    var defaults = {
	id: nextId(),
	description: 'blank agent',
	inventory: {},
	money: 'money',
	values: {},
	costs: {},
	wakeTime: 0,
	rate: 1,
	period: {number:0, startTime:0},
	nextWake: poissonWake
    };
    Object.assign(this, defaults, JSON.parse(JSON.stringify(options || {})));
    this.init();
};

util.inherits(Agent, EventEmitter);

Agent.prototype.init = function(newSettings){
    var i,l;
    var mySettings = {};
    if (typeof(newSettings)==='object'){
	// work with a shallow copy of the newSettings so
	// the code can delete the inventory setting without side effects
	mySettings = Object.assign({}, newSettings);
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
    this.wakeTime = this.nextWake();
};

Agent.prototype.initPeriod = function(unsafePeriod){
    // period might look like this
    // period = {number:5, startTime:50000, init: {inventory:{X:0, Y:0}, values:{X:[300,200,100,0,0,0,0]}}}
    // first do a deep copy, then it is safe to make assignments
    var period = JSON.parse(JSON.stringify(unsafePeriod));
    if (typeof(period)==='object')
	this.period = period;
    else if (typeof(period)==='number')
	this.period.number = period;
    if (typeof(this.period.startTime)==='number')
	this.wakeTime = this.period.startTime;
    this.init(this.period.init);
    this.emit('pre-period');
};

Agent.prototype.endPeriod = function(){
    if (typeof(this.produce)==='function') this.produce();
    if (typeof(this.redeem)==='function') this.redeem();
    this.emit('post-period');
};

Agent.prototype.wake = function(info){
    this.emit('wake', info);
    this.wakeTime = this.nextWake();
};

Agent.prototype.transfer = function(myTransfers, memo){
    var goods, i, l;
    if (myTransfers){
	this.emit('pre-transfer', myTransfers, memo);
	goods = Object.keys(myTransfers);
	for(i=0,l=goods.length; i<l; ++i){
	    if (this.inventory[goods[i]])
		this.inventory[goods[i]] += myTransfers[goods[i]];
	    else
		this.inventory[goods[i]] = myTransfers[goods[i]];
	}
	this.emit('post-transfer', myTransfers, memo);
    }
};

Agent.prototype.unitCostFunction = function(good, hypotheticalInventory){
    var result;
    var costs = this.costs[good];
    if ((Array.isArray(costs)) && (hypotheticalInventory[good] <= 0)){
	result = costs[-hypotheticalInventory[good]];
    }
    return result;
};

Agent.prototype.unitValueFunction = function(good, hypotheticalInventory){
    var result;
    var vals = this.values[good];
    if ((Array.isArray(vals)) && (hypotheticalInventory[good] >= 0)){
	result = vals[hypotheticalInventory[good]];
    }
    return result;
};

Agent.prototype.redeem = function(){
    var i,l,g;
    var trans = {};
    var goods;
    if (this.values){
	goods = Object.keys(this.values);
	trans[this.money] = 0;
	for(i=0,l=goods.length;i<l;++i){
	    g = goods[i];
	    if (this.inventory[g]>0){
		trans[g] = -this.inventory[g];
		trans[this.money] += sum(this.values[g].slice(0,this.inventory[g]));
	    }
	}
	this.emit('pre-redeem', trans);
	this.transfer(trans, {isRedeem:1});
	this.emit('post-redeem',trans);
    }
};

Agent.prototype.produce = function(){
    var i,l,g;
    var trans = {};
    var goods;
    if (this.costs){ 
	goods = Object.keys(this.costs);
	trans[this.money] = 0;
	for(i=0,l=goods.length;i<l;++i){
	    g = goods[i];
	    if (this.inventory[g]<0){
		trans[this.money] -= sum(this.costs[g].slice(0,-this.inventory[g]));
		trans[g] = -this.inventory[g];
	    }
	}
	this.emit('pre-produce', trans);
	this.transfer(trans, {isProduce:1});
	this.emit('post-produce', trans);
    }
};

ziAgent = function(options){
    // from an idea developed by Gode and Sunder in a series of economics papers
    var defaults = {
	description: 'Gode and Sunder style ZI Agent',
	markets: {},
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
    var unitValue, unitCost;
    var good;
    var myPrice;
    for(i=0,l=names.length;i<l;++i){
	good = names[i];
	unitValue = this.unitValueFunction(good, this.inventory);
	if (unitValue>0){
	    myPrice = this.bidPrice(unitValue);
	    this.bid(good, myPrice);
	}
	unitCost = this.unitCostFunction(good, this.inventory);
	if (unitCost>0){
	    myPrice = this.askPrice(unitCost);
	    this.ask(good, myPrice);
	}
    }
};

ziAgent.prototype.bidPrice = function(value){
    if (value===this.minPrice) return value;
    if (value<this.minPrice) return undefined;
    var p = ProbJS.uniform(this.minPrice, value)();
    if (this.integer) p = Math.floor(p);
    return p;
};

ziAgent.prototype.askPrice = function(cost){
    if (cost===this.maxPrice) return cost;
    if (cost>this.maxPrice) return undefined;
    var p = ProbJS.uniform(cost, this.maxPrice)();
    if (this.integer) p = Math.floor(p);
    return p;
};

Pool = function(){
    this.agents = [];
    this.agentsById = {};
};

Pool.prototype.push = function(agent){
    if (!(agent instanceof Agent))
	throw new Error("Pool.push(agent), agent is not an instance of Agent or descendents");
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
/* istanbul ignore next */
try { setImmediate(function(){ hasSetImmediate=true; }); } catch(e){};

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
	    /* istanbul ignore next */
	    if (hasSetImmediate) setImmediate(loop);
	    /* istanbul ignore next */
	    else setTimeout(loop,0);
	}
    };
    /* istanbul ignore next */
    if (hasSetImmediate) setImmediate(loop);
    /* istanbul ignore next */
    else setTimeout(loop,0);
};

Pool.prototype.syncRun = function(untilTime){
    var nextAgent = this.next();
    while (nextAgent.wakeTime < untilTime){
	nextAgent.wake();
	nextAgent = this.next();
    }
};

Pool.prototype.initPeriod = function(param){
    var i,l;
    if (Array.isArray(param) && (param.length>0)){
	// this is safe because Agent.initPeriod does a deepcopy 
	for(i=0,l=this.agents.length; i<l; i++)
	    this.agents[i].initPeriod(param[i%(param.length)]);
    } else {
	for(i=0,l=this.agents.length; i<l; i++)
	    this.agents[i].initPeriod(param);
    }
};

Pool.prototype.endPeriod = function(){
    var i,l;
    for(i=0,l=this.agents.length;i<l;i++)
	this.agents[i].endPeriod();
};

var sum = function(a){
    var i,l,total=0;
    for(i=0,l=a.length;i<l;++i)
	total += a[i];
    return total;
};

var dot = function(a,b){
    var i,l,total=0;
    /* istanbul ignore next */
    if (a.length!==b.length)
	throw new Error("market-agents: vector dimensions do not match in dot(a,b)");
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
	    this.agentsById[tradeSpec.buyId[0]].transfer(buyerTransfer, {isTrade:1, isBuy:1});
	    for(i=0,l=tradeSpec.prices.length;i<l;++i){
		sellerTransfer = {};
		sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[i];
		sellerTransfer[tradeSpec.money] = tradeSpec.prices[i]*tradeSpec.sellQ[i];
		this.agentsById[tradeSpec.sellId[i]].transfer(sellerTransfer, {isTrade:1, isSellAccepted:1});
	    }
	} else if (tradeSpec.bs==='s'){
	    if (tradeSpec.sellId.length!==1)
		throw new Error("Pool.trade expected tradeSpec.sellId.length===1. got:"+tradeSpec.sellId.length);
	    if (tradeSpec.sellQ[0] !== sum(tradeSpec.buyQ))
		throw new Error("Pool.trade invalid sell -- tradeSpec sellQ[0] != sum(buyQ)");
	    sellerTransfer = {};
	    sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[0];
	    sellerTransfer[tradeSpec.money] = dot(tradeSpec.buyQ,tradeSpec.prices);
	    this.agentsById[tradeSpec.sellId[0]].transfer(sellerTransfer, {isTrade:1, isSell:1});
	    for(i=0,l=tradeSpec.prices.length;i<l;++i){
		buyerTransfer = {};
		buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[i];
		buyerTransfer[tradeSpec.money] = -tradeSpec.prices[i]*tradeSpec.buyQ[i];
		this.agentsById[tradeSpec.buyId[i]].transfer(buyerTransfer, {isTrade:1, isBuyAccepted:1});
	    }
	}
	
    }
};

module.exports = {
    Agent: Agent,
    ziAgent: ziAgent,
    Pool: Pool
};



