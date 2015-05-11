locality = new Mongo.Collection("locality") ;

var refreshing = new ReactiveVar(false) ;

if (Meteor.isClient) {
  // counter starts at 0
  Session.setDefault('counter', 0);

  Template.hello.helpers({
    locality : function(){
      return locality.find() ;
    },
    description : function(actualWeather){
      return actualWeather.weather[0].description ;
    },
    toCelsius : function(kelvin){
      return Math.round((kelvin - 273.15)*10)/10 ;
    },
    toIsoDate : function(unixtime){
      return new Date(unixtime*1000).toISOString() ;
    },
    toMinAge : function(unixtime){
      return Math.round((new Date().getTime() - new Date(unixtime*1000).getTime())/(60 * 60 * 1000)) ;
    },
    refreshingStatus : function(){
      console.log("refreshing");
      return refreshing.get();
    }
  });

  Template.hello.events({
    'submit .js-locality-new': function(event) {
      event.preventDefault();

      var $input = $(event.target).find('[type=text]');
      if (! $input.val())
        return;

      Meteor.call("addLocality",$input.val()) ;

      $input.val('');
    },
    'click .js-locality-delete': function() {
      locality.remove(this._id) ;
    }
  });
}

if (Meteor.isServer) {

  var getMeteo = function (place){
    var url = "http://api.openweathermap.org/data/2.5/weather?q=" + encodeURIComponent(place.name) + "&APPID=cd886a728fff3a51b609bca977412eba" ;
    console.log(url) ;
    return HTTP.get(url).data ;
  }

  var addLocality = function(name){
    var newLocality = locality.insert({
      name : name
    }) ;
    console.log("newLocality",newLocality) ;
    this.unblock() ;
    updateMeteoForLocality(locality.findOne(newLocality)) ;
  }

  var updateMeteoForLocality = function(actualLocality){
    actualLocality.lastWeather = actualLocality.actualWeather || {};
    actualLocality.actualWeather = getMeteo(actualLocality) ;
    if (actualLocality.lastWeather.main && actualLocality.actualWeather.main){
      if (actualLocality.lastWeather.dt != actualLocality.actualWeather.dt) {
        if (Math.round(actualLocality.lastWeather.main.pressure) < Math.round(actualLocality.actualWeather.main.pressure)){
          actualLocality.forecast = ":)" ;
        }
        if (Math.round(actualLocality.lastWeather.main.pressure) > Math.round(actualLocality.actualWeather.main.pressure)) {
          actualLocality.forecast = ":(" ;
        }
        if (Math.round(actualLocality.lastWeather.main.pressure) === Math.round(actualLocality.actualWeather.main.pressure)) {
          actualLocality.forecast = ":|" ;
        }
      }
    } else {
      actualLocality.forecast = "?" ;
    }
    actualLocality.lastFetch = new Date() ;
    locality.update(actualLocality._id,actualLocality);
  }

  var refreshMeteoForAll = function(){
    try{
      refreshing.set(true);
      console.log("start refreshing meteo") ;
      var all = locality.find();
      all.forEach(updateMeteoForLocality) ;
    } catch (e){
      console.log("error refreshing meteo", e.message) ;
    }
    console.log("done refreshing meteo")
    refreshing.set(false) ;
    Meteor.setTimeout(refreshMeteoForAll,120000) ;
  }

  Meteor.methods({
    getMeteo: getMeteo,
    addLocality : addLocality
  }) ;


  Meteor.startup(function () {
    // code to run on server at startup
    refreshMeteoForAll();
  });
}