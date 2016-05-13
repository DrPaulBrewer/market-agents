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
 
##Usage

    var myAgent = new MarketAgents.Agent();
    var myZIAgent = new MarketAgents.ziAgent();
    myAgent.on('some-event', function(...){...});
    var myPool = new MarketAgents.Pool();
    for(var i=0,l=100;i<l;++i) myPool.push(new MarketAgents.ziAgent());

##Events

TBA

##Functions     

TBA

