/**
 * PUSH Notification server V 0.2
 * (c) Telefonica Digital, 2012 - All rights reserver
 * Fernando Rodríguez Sela <frsela@tid.es>
 * Guillermo Lopez Leal <gll@tid.es>
 */

var mongodb = require("mongodb");
var server_info = require("../../config.js").NS_AS.server_info;
var log = require("../logger.js").getLogger;

var ddbbsettings = require("../../config.js").NS_AS.ddbbsettings;

function datastore() {
  log.info("MongoDB data store loaded.");

  // In-Memory storage
  this.nodesTable = {};

  // Connection to MongoDB
  this.db = new mongodb.Db(
    ddbbsettings.ddbbname,
    new mongodb.Server(
      ddbbsettings.host,
      ddbbsettings.port,
      {
        auto_reconnect: ddbbsettings.auto_reconnect,
        poolSize: ddbbsettings.poolSize
      }
    ),
    {
      native_parser: ddbbsettings.native_parser
    }
  );

  // Establish connection to db
  this.db.open(function(err, db) {
    if(err == null) {
      log.info("Connected to MongoDB!");
    } else {
      log.error("Error connecting to MongoDB ! - " + err);
      // TODO: Cierre del servidor? Modo alternativo?
    }
  });
}

datastore.prototype = {
  /**
   * Register a new node. As a parameter, we receive the connector object
   */
  registerNode: function (token, connector) {
    if(this.nodesTable[token]) {
      log.debug("Removing old node token " + token);
      delete(this.nodesTable[token]);
    }

    // Register a new node
    this.nodesTable[token] = connector;

    // Register in MONGO that this server manages this node
    this.db.collection("nodes", function(err, collection) {
      collection.update( { 'token': token },
                         { 'token': token, 'serverId': server_info.id },
                         { upsert: true },
                         function(err,d) {
        if(err == null)
          log.debug("Node inserted/update into MongoDB");
        else
          log.debug("Error inserting/updating node into MongoDB");
      });
    });
  },

  /**
   * Gets a node connector
   */
  getNode: function (token) {
    if(this.nodesTable[token]) {
      return this.nodesTable[token];
    }
    return false;
  },

  // TODO: Verify that the node exists before add the application
  /**
   * Register a new application
   */
  registerApplication: function (appToken, nodeToken) {
    // Store in MongoDB
    this.db.collection("apps", function(err, collection) {
      collection.update( {'token': appToken},
                         {$push : { 'node': nodeToken }},
                         {upsert: true},
                         function(err,d) {
        if(err == null)
          log.debug("Application inserted into MongoDB");
        else
          log.debug("Error inserting application into MongoDB: " + err);
      });
    });

  },

  /**
   * Gets an application node list
   */
  getApplication: function (token, cbfunc) {
    // Get from MongoDB
    this.db.collection("apps", function(err, collection) {
      collection.find( { 'token': token } ).toArray(function(err,d) {
        if(err == null)
          log.debug(d);
        else
          log.debug("Error finding application into MongoDB: " + err);
      });
    });
  }
}

///////////////////////////////////////////
// Singleton
///////////////////////////////////////////
var ds = new datastore();
function getDataStore() {
  return ds;
}

exports.getDataStore = getDataStore;