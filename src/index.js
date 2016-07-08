import * as async from 'async'
import {EventEmitter} from 'events'
import * as ProbJS from 'prob.js'
import clone from 'clone';

let privateNextId = 1;
function nextId(){ return privateNextId++; }

function sum(a){
    let i,l,total=0;
    for(i=0,l=a.length;i<l;++i)
        total += a[i];
    return total;
}

function dot(a,b){
    let i,l,total=0;

    /* istanbul ignore next */

    if (a.length!==b.length)
        throw new Error("market-agents: vector dimensions do not match in dot(a,b)");
    for(i=0,l=a.length;i<l;++i)
        if (b[i])
            total += a[i]*b[i];
    return total;
}


function poissonWake(){
    const delta = ProbJS.exponential(this.rate)();
    const result =  this.wakeTime+delta;
    if (result>0)
        return result;
}

export class Agent extends EventEmitter {
    
    constructor(options){
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
                number:0, 
                duration:1000,
                equalDuration: true
            },
            nextWake: poissonWake
        };
        Object.assign(this, defaults, clone(options, false));
        this.init();
    }


    init(newSettings){
        if (typeof(newSettings)==='object'){
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
        this.wakeTime = this.nextWake();
    }
    
    initPeriod(period){
        // period might look like this
        // period = {number:5, startTime:50000, init: {inventory:{X:0, Y:0}, values:{X:[300,200,100,0,0,0,0]}}}
        // or period could be simply a number
        if (typeof(period)==='object')
            this.period = clone(period, false);
        else if (typeof(period)==='number')
            this.period.number = period;
        if (this.period.equalDuration && this.period.duration){
            this.period.startTime = this.period.number*this.period.duration;
            this.period.endTime = (1+this.period.number)*this.period.duration;
        }
        if (typeof(this.period.startTime)==='number')
            this.wakeTime = this.period.startTime;
        this.init(this.period.init);
        this.emit('pre-period');
    }
    
    endPeriod(){
        if (typeof(this.produce)==='function') this.produce();
        if (typeof(this.redeem)==='function') this.redeem();
        this.emit('post-period');
    }

    pctPeriod(){
        if ((this.period.startTime!==undefined) && (this.period.endTime>0) && (this.wakeTime!==undefined)){
            return (this.wakeTime-this.period.startTime)/(this.period.endTime-this.period.startTime);
        }
    }

    poissonWakesRemainingInPeriod(){
        if ((this.rate>0) && (this.wakeTime!==undefined) && (this.period.endTime>0)){
            return (this.period.endTime - this.wakeTime)*this.rate;
        }
    }

    wake(info){
        this.emit('wake', info);
        const nextTime = this.nextWake();
        if (this.period.endTime){
            if (nextTime<this.period.endTime) 
                this.wakeTime = nextTime;
            else
                this.wakeTime = undefined;
        } else {
            this.wakeTime = nextTime;
        }
    }
    
    transfer(myTransfers, memo){
        if (myTransfers){
            this.emit('pre-transfer', myTransfers, memo);
            const goods = Object.keys(myTransfers);
            for(let i=0,l=goods.length;i<l;++i){
                if (this.inventory[goods[i]])
                    this.inventory[goods[i]] += myTransfers[goods[i]];
                else
                    this.inventory[goods[i]] = myTransfers[goods[i]];
            }
            this.emit('post-transfer', myTransfers, memo);
        }
    }
    
    unitCostFunction(good, hypotheticalInventory){
        const costs = this.costs[good];
        if ((Array.isArray(costs)) && (hypotheticalInventory[good] <= 0)){
            return costs[-hypotheticalInventory[good]];
        }
    }

    unitValueFunction(good, hypotheticalInventory){
        const vals = this.values[good];
        if ((Array.isArray(vals)) && (hypotheticalInventory[good] >= 0)){
            return vals[hypotheticalInventory[good]];
        }
    }

    redeem(){
        if (this.values){
            const trans = {};
            const goods = Object.keys(this.values);
            trans[this.money] = 0;
            for(let i=0,l=goods.length;i<l;++i){
                let g = goods[i];
                if (this.inventory[g]>0){
                    trans[g] = -this.inventory[g];
                    trans[this.money] += sum(this.values[g].slice(0,this.inventory[g]));
                }
            }
            this.emit('pre-redeem', trans);
            this.transfer(trans, {isRedeem:1});
            this.emit('post-redeem',trans);
        }
    }

    produce(){
        if (this.costs){ 
            const trans = {};
            const goods = Object.keys(this.costs);
            trans[this.money] = 0;
            for(let i=0,l=goods.length;i<l;++i){
                let g = goods[i];
                if (this.inventory[g]<0){
                    trans[this.money] -= sum(this.costs[g].slice(0,-this.inventory[g]));
                    trans[g] = -this.inventory[g];
                }
            }
            this.emit('pre-produce', trans);
            this.transfer(trans, {isProduce:1});
            this.emit('post-produce', trans);
        }
    }
}

export class ZIAgent extends Agent {
    // from an idea developed by Gode and Sunder in a series of economics papers
    constructor(options){
        const defaults = {
            description: 'Gode and Sunder style ZI Agent',
            markets: [],
            minPrice: 0,
            maxPrice: 1000
        };
        super(Object.assign({}, defaults, options));
        this.on('wake', this.sendBidsAndAsks);
    }
    
    sendBidsAndAsks(){
        for(let i=0,l=this.markets.length;i<l;++i){
            let market = this.markets[i];
            let unitValue = this.unitValueFunction(market.goods, this.inventory);
            if (unitValue>0){
                if (this.ignoreBudgetConstraint)
                    unitValue = this.maxPrice;
                let myPrice = this.bidPrice(unitValue, market); // calculate my buy price proposal
                if (myPrice)
                    this.bid(market, myPrice); // send my price proposal
            }
            let unitCost = this.unitCostFunction(market.goods, this.inventory);
            if (unitCost>0){
                if (this.ignoreBudgetConstraint)
                    unitCost = this.minPrice;
                let myPrice = this.askPrice(unitCost, market); // calculate my sell price proposal
                if (myPrice)
                    this.ask(market, myPrice); // send my price proposal
            }
        }
    }

    bidPrice(marginalValue){
        if (typeof(marginalValue)!=='number') return undefined;
        let p;
        if (marginalValue===this.minPrice) return marginalValue;
        if (marginalValue<this.minPrice) return undefined;
        if (this.integer){

            /* because Floor rounds down, add 1 to value to be in the range of possible prices */
            /* guard against rare edge case with do/while */

            do {
                p = Math.floor(ProbJS.uniform(this.minPrice,marginalValue+1)());
            } while (p>marginalValue);

        } else {
            p = ProbJS.uniform(this.minPrice, marginalValue)();
        }
        return p;
    }

    askPrice(marginalCost){
        if (typeof(marginalCost)!=='number') return undefined;
        let p;
        if (marginalCost===this.maxPrice) return marginalCost;
        if (marginalCost>this.maxPrice) return undefined;
        if (this.integer){

            /* because Floor rounds down, add 1 to value to be in the range of possible prices */
            /* guard against rare edge case with do/while */

            do {
                p = Math.floor(ProbJS.uniform(marginalCost,this.maxPrice+1)());
            } while (p>this.maxPrice);

        } else {
            p = ProbJS.uniform(marginalCost, this.maxPrice)();
        }
        return p;
    }
}

const um1p2 = ProbJS.uniform(-1,2);
const um1p1 = ProbJS.uniform(-1,1);

export class UnitAgent extends ZIAgent {
    constructor(options){
        const defaults = {
            description: "Paul Brewer's HBEER UNIT agent that bids/asks within 1 price unit of previous price"
        };
        super(Object.assign({}, defaults, options));
    }


    randomDelta(){
        let delta;
        if (this.integer){
            do {
                delta = Math.floor(um1p2());
            } while ((delta <= -2) || (delta >= 2.0));
        } else {
            do {
                delta = um1p1();
            } while ( (delta < -1) || (delta > 1) );
        }
        return delta;
    }

    bidPrice(marginalValue, market){
	let p;
        if (typeof(marginalValue)!=='number') return undefined;
        const previous = market.lastTradePrice();
        if (previous)
            p = previous+this.randomDelta();
        else
            p = super.bidPrice(marginalValue);
        if ((p>marginalValue) || (p>this.maxPrice) || (p<this.minPrice)) return undefined;
        return (p && this.integer)? Math.floor(p): p;
    }
    
    askPrice(marginalCost, market){
        if (typeof(marginalCost)!=='number') return undefined;
        let p;
        const previous = market.lastTradePrice();
        if (previous)
            p = previous+this.randomDelta();
        else
            p = super.askPrice(marginalCost);
        if ((p<marginalCost) || (p>this.maxPrice) || (p<this.minPrice)) return undefined;
        return (p && this.integer)? Math.floor(p): p;
    }
}

/* see e.g. "High Performance Bidding Agents for the Continuous Double Auction" 
 *                Gerald Tesauro and Rajarshi Das, Institute for Advanced Commerce, IBM 
 *
 *  http://researcher.watson.ibm.com/researcher/files/us-kephart/dblauc.pdf
 *
 *      for discussion of Kaplan's Sniper traders on pp. 4-5
*/

export class KaplanSniperAgent extends ZIAgent {
    constructor(options){
        const defaults = {
            description: "Kaplan's snipers, trade on 'juicy' price, or low spread, or end of period",
            desiredSpread: 10
        };
        super(Object.assign({}, defaults, options));
    }


    bidPrice(marginalValue, market){
        if (typeof(marginalValue)!=='number') return undefined;
        const currentBid = market.currentBidPrice();
        const currentAsk = market.currentAskPrice();
        
        // a trade can only occur if currentAsk <= marginalValue
        if (currentAsk <= marginalValue){
            
            // snipe if ask price is less than or equal to juicy ask price
            const juicyPrice = this.getJuicyAskPrice();
            if ((juicyPrice>0) && (currentAsk<=juicyPrice))
                return currentAsk;

            // snipe if low bid ask spread 
            if ((currentAsk>0) && (currentBid>0) && ((currentAsk-currentBid)<=this.desiredSpread))
                return currentAsk;

            // snipe if period end is three wakes away or less
            if (this.poissonWakesRemainingInPeriod()<=3)
                return currentAsk;
        }
        // otherwise return undefined
    }

    askPrice(marginalCost, market){
        if (typeof(marginalCost)!=='number') return undefined;
        const currentBid = market.currentBidPrice();
        const currentAsk = market.currentAskPrice();
        // only trade if currentBid >= marginalCost
        if (currentBid >= marginalCost){
            
            // snipe if bid price is greater than or equal to juicy bid price
            const juicyPrice = this.getJuicyBidPrice();
            if ((juicyPrice>0) && (currentBid>=juicyPrice))
                return currentBid;

            // snipe if low bid ask spread
            if ((currentAsk>0) && (currentBid>0) && ((currentAsk-currentBid)<=this.desiredSpread))
                return currentBid;

            // snipe if period end is three wakes away or less
            if (this.poissonWakesRemainingInPeriod()<=3)
                return currentBid;
        }
        // otherwise return undefined
    }
}

export class Pool { 
    constructor(){
        this.agents = [];
        this.agentsById = {};
    }
    
    push(agent){
        if (!(agent instanceof Agent))
            throw new Error("Pool.push(agent), agent is not an instance of Agent or descendents");
        if (!this.agentsById[agent.id]){
            this.agents.push(agent);
            this.agentsById[agent.id] = agent;
        }
    }

    next(){
        if (this.nextCache) return this.nextCache;
        let tMin=1e20, i=0, l=this.agents.length, A=this.agents, t=0, result=0;
        for(;i<l;i++){
            t = A[i].wakeTime;
            if ( (t>0) && (t<tMin) ){
                result = A[i];
                tMin = t;
            }
        }
        this.nextCache = result;
        return result;
    }

    wake(){
        const A = this.next();
        if (A){
            A.wake();
            // wipe nextCache
            delete this.nextCache;
        }
    }

    endTime(){
        let endTime = 0;
        for(let i=0,l=this.agents.length;i<l;++i){
            let a = this.agents[i];
            if (a.period.endTime > endTime)
                endTime = a.period.endTime;
        }
        if (endTime>0) return endTime;
    }

    run(untilTime, done, batch){
        // note: setTimeout slows this down significnatly if setImmediate is not available
        const that = this;
        if (typeof(done)!=='function')
            throw new Error("Pool.run: done callback function undefined");
        async.whilst(
            function(){ 
                const nextAgent = that.next();
                return (nextAgent && (nextAgent.wakeTime < untilTime));
            },
            function(cb){
                async.setImmediate(function(){
                    that.syncRun(untilTime, batch || 1);
                    cb();
                });
            },
            function(e){
                done.call(that,e);
            }
        );
    }

    syncRun(untilTime, limitCalls){
        let nextAgent = this.next();
        let calls = 0;
        while (nextAgent && (nextAgent.wakeTime < untilTime) && (!(calls>=limitCalls)) ){
            this.wake();
            nextAgent = this.next();
            calls++;
        }
    }

    initPeriod(param){
        // passing param to all the agents is safe because Agent.initPeriod does a deep clone
        if (Array.isArray(param) && (param.length>0)){
            for(let i=0,l=this.agents.length;i<l;i++)
                this.agents[i].initPeriod(param[i%(param.length)]);
        } else {
            for(let i=0,l=this.agents.length;i<l;i++)
                this.agents[i].initPeriod(param);
        }
    }

    endPeriod(){
        for(let i=0,l=this.agents.length;i<l;i++)
            this.agents[i].endPeriod();
    }
    
    trade(tradeSpec){
        let i,l,buyerTransfer,sellerTransfer;
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
    }

    distribute(field, good, aggregateArray){
        let i,l;
        let myCopy;
        if (Array.isArray(aggregateArray)){
            myCopy = aggregateArray.slice();
        } else if (typeof(aggregateArray)==='string') {
            myCopy = (aggregateArray
                      .replace(/,/g," ")
                      .split(/\s+/)
                      .map(function(s){ return +s; })
                      .filter(function(v){ return (v>0); })
                     );
        } else {

            /* istanbul ignore next */

            throw new Error("Error: Pool.prototype.distribute: expected aggregate to be Array or String, got: "+typeof(aggregateArray));

        }
        if ((field!=='values') && (field!=='costs'))
            throw new Error("Pool.distribute(field,good,aggArray) field should be 'values' or 'costs', got:"+field);
        for(i=0,l=this.agents.length;i<l;++i){
            if (typeof(this.agents[i][field])==='undefined')
                this.agents[i][field] = {};
            this.agents[i][field][good] = [];
        }
        i = 0;
        l = this.agents.length;
        while(myCopy.length>0){
            this.agents[i][field][good].push(myCopy.shift());
            i = (i+1) % l;
        }
    }
}

