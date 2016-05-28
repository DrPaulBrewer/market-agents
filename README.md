market-agents
====

[![Build Status](https://travis-ci.org/DrPaulBrewer/market-agents.svg?branch=master)](https://travis-ci.org/DrPaulBrewer/market-agents)
[![Coverage Status](https://coveralls.io/repos/github/DrPaulBrewer/market-agents/badge.svg?branch=master)](https://coveralls.io/github/DrPaulBrewer/market-agents?branch=master)


## Provides EventEmitter Agent framework for robot trading in economic and financial simulations

### Warning: versions less than 1.0.0 are pre-release/experimental, may be subject to massive change without notice or not work 

##Installation

    npm install market-agents --save

##Initialization

    var MarketAgents = require('market-agents');
    // unpack constructors
    const Agent = MarketAgents.Agent;
    const ziAgent = MarketAgents.Agent;
    const Pool = MarketAgents.Pool;
 
##Blurb

    var myAgent = new Agent({inventory: {money:1000, X:5}});
    var myZIAgent = new ziAgent();
    myAgent.on('some-event', function(...){...});
    var myPool = new Pool();
    for(var i=0,l=100;i<l;++i) myPool.push(new ziAgent());
    myPool.initPeriod([type1Params,type2Params,...,typeNParams]);
    myPool.runSync(10000); 
    myPool.endPeriod();

##Agent Construction
    
    var myAgent = new Agent({option1:value1, option2:value2, ... });
    
Creates a new `Agent` instance; internally the `Agent` class is implemented as a subclass of `EventEmitter`.

### `new Agent(options)` constructor options


| option | type | default | description |
|--------|------|---------|-------------|
|`costs`| object keys:goods, values: Array of number | {} | unit costs of goods for producing goods in `Agent.prototype.produce()` (usually at end-of-period) |  
|`description`| any | "Agent" | description of agent, unused |
| `id` | number | autoincremented number | unique agent id number. *Most apps should leave .id unset and let the autoincrementer set it * |
|`inventory`| object | {} | initial money and goods owned by agent |
|`nextWake`| function returning next wake up time, no paramters, `this` Agent context | `poissonWake` providing conjugate exponential wake time for Poisson distribution |  alternate function for determining next wake time |
|`money`| string | "money" | name of goods used as money |
|`period`| object | `{number:0, startTime:0}` | initial parameters for .initPeriod |
|`rate`| number | 1 | Poisson firing rate of Agent's .wake() events |
|`values`| object keys:goods, values: Array of number | {} | unit values for redeeming goods in `Agent.prototype.redeem()` (usually at end-of-period) |
|`wakeTime`| number | 0 | initial wake up time for Agent's first action|

### `Agent.prototype` methods

each Agent instance has access to these methods

|Agent method| internal usage | param | type | description | 
|------------|----------------|-------|------|-------------|
|`Agent.prototype.init(newSettings)`| called by `Agent.prototype.initPeriod` | `newSettings` | object |  copies `newSettings.inventory` to `this.inventory` without overwriting inventory levels in `this.inventory` not in `newSettings.inventory, then copies any remaining properties of `newSettings` to `this`; If `this.money` is set and money inventory is undefined, sets money inventory to zero. sets `this.wakeTime` to next wake up time.  |


##Agent Events

*wake*
Parameters: info
Emitted-By: Agent.prototype.wake
When: when Agent.wake(info) is called.  
Note: this.wakeTime contains the current official agent time.  The event is triggered before calculating the new wakeTime.
Use this for: agent strategy (placing bids, asks, responding to others bids/asks)

*pre-transfer*
Parameters: myTransfers, memo
Emitted-By: Agent.prototype.transfer
When: before modifying the agent's inventory
Use this for: altering or removing transfers before they occur

*post-transfer*
Parameters: myTransfers, memo
Emitted-By: Agent.prototype.transfer
When: after modifying the agent's inventory
Use this for: logging transfers, taking other actions after the transfer

*pre-period*
Parameters: None
Emitted-By: Agent.prototype.initPeriod
When: after new period information has been copied to agent
Use this for:  additional agent set up at the beginning of every period

*post-period*
Parameters: None
Emitted-By: Agent.prototype.endPeriod
When: after all period activities, produce and redeem, have completed
Use this for: any final agent accounting, profit capture, cleanup, etc. before ending the period

*pre-redeem*
Parameters: trans
Emitted-By: Agent.prototype.redeem
When: Typically at end of a period, after a redemption transfer has been calculated, but before the transfer takes place
Use this for: modifying the redemption transfer

*post-redeem*
Parameters: trans
Emitter-By: Agent.prototype.redeem
When: after a redemption transfer has been processed and added to the agent's inventory
Use this for: logging redemption amounts, taking other actions after a redemption

*pre-produce*
Parameters: trans
Emtited-By: Agent.prototype.produce
When: Typically at the end of a period, after a production transaction has been calculated, but before the transfer
Use this for: modifying the production transfer 

*post-produce*
Parameters: trans
Emitted-By:Agent.prototype.produce
When: after a production transfer has been processed and added to the agent's inventory
Use this for: logging production amounts, taking other actions after production

##ZiAgent Events

ziAgent inherits all event behavior from Agent and adds no unique events to Agent.

ziAgent registers ziAgent.Prototype.sendBidsAndAsks as the first responder to the Agent *Wake* event.


##Pool Events

Pool is not an EventEmitter of its own.  

Instead, several Pool methods call methods on all agents in the Pool, triggering related Agent events.



