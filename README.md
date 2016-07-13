market-agents
====

[![Build Status](https://travis-ci.org/DrPaulBrewer/market-agents.svg?branch=master)](https://travis-ci.org/DrPaulBrewer/market-agents)
[![Coverage Status](https://coveralls.io/repos/github/DrPaulBrewer/market-agents/badge.svg?branch=master)](https://coveralls.io/github/DrPaulBrewer/market-agents?branch=master)
[![Documentation Status](https://doc.esdoc.org/github.com/DrPaulBrewer/market-agents/badge.svg)


Provides EventEmitter Agent framework for robot trading in economic and financial simulations

##Documentation

The [ESDoc hosted documentation for market-agents](https://doc.esdoc.org/github.com/DrPaulBrewer/market-agents/) may be preferable as it should
include both this information and documentation automatically generated from the source code and source code comments.

##Installation

    npm install market-agents --save

##Initialization

    import * as MarketAgents from 'market-agents'; // ES6 
    // or
    const MarketAgents = require('market-agents'); // CJS
    // unpack some constructors
    const { Agent, ZIAgent, Pool } = MarketAgents;

##Agent classes, methods, etc.

See the [ESDoc hosted documentation for market-agents](https://doc.esdoc.org/github.com/DrPaulBrewer/market-agents/)

##Agent Event Reference

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

##Trader Events

Trader registers ziAgent.Prototype.sendBidsAndAsks as the first responder to the Agent *Wake* event.

##Trader subclasses (e.g. ZIAgent, etc.)

inherit Agent and Trader events and behavior

##Pool Events

Pool is not an EventEmitter of its own.  

Instead, several Pool methods call methods on all agents in the Pool, triggering related Agent events.








