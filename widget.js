(function() {
// Load underscore
var _ ;
if(typeof _ === 'undefined'){
    var script_tag = document.createElement('script');
    script_tag.setAttribute("type","text/javascript");
    script_tag.setAttribute("src",
        "https://s3.amazonaws.com/tidefish-widget/underscore.min.js");
    (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);
};

// Localize jQuery variable
var jQuery;

/******** Load jQuery if not present *********/
if (window.jQuery === undefined || window.jQuery.fn.jquery !== '1.11.1') {
    var script_tag = document.createElement('script');
    script_tag.setAttribute("type","text/javascript");
    script_tag.setAttribute("src",
        "http://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js");
    if (script_tag.readyState) {
      script_tag.onreadystatechange = function () { // For old versions of IE
          if (this.readyState == 'complete' || this.readyState == 'loaded') {
              scriptLoadHandler();
          }
      };
    } else { // Other browsers
      script_tag.onload = scriptLoadHandler;
    }
    // Try to find the head, otherwise default to the documentElement
    (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);
} else {
    // The jQuery version on the window is the one we want to use
    jQuery = window.jQuery;
    main();
}

/******** Called once jQuery has loaded ******/
function scriptLoadHandler() {
    jQuery = window.jQuery.noConflict(true);
    main(); 
}



function init(){
  /* Load Moment */
  var script_tag = document.createElement('script');
  script_tag.setAttribute("type","text/javascript");
  script_tag.setAttribute("src",
      "https://s3.amazonaws.com/tidefish-widget/moment.min.js");
  (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);

  /* Load DDP */
  var script_tag = document.createElement('script');
  script_tag.setAttribute("type","text/javascript");
  script_tag.setAttribute("src",
      "https://s3.amazonaws.com/tidefish-widget/meteor-ddp.min.js");
  (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);

  /* Load Calendar */
  var script_tag = document.createElement('script');
  script_tag.setAttribute("type","text/javascript");
  script_tag.setAttribute("src",
      "https://s3.amazonaws.com/tidefish-widget/cal.min.js");
  (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);
  
  /* Load Calendar Templates */
  var script_tag = document.createElement('script');
  script_tag.setAttribute("type","text/template");
  script_tag.setAttribute("id","tideFishCalTemplate");
  script_tag.setAttribute("src",
      "https://s3.amazonaws.com/tidefish-widget/widget-cal-template.html");
  (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);
  var script_tag = document.createElement('script');
  script_tag.setAttribute("type","text/template");
  script_tag.setAttribute("id","tideFishEventsDisplay");
  script_tag.setAttribute("src",
      "https://s3.amazonaws.com/tidefish-widget/widget-schedule-template.html");
  (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);
}

/******** Library startup helpers ******/

/*
 * Create calendar object and helpers
 */
function SetupCalendar( events ){
  var calTemplate = jQuery('script#tideFishCalTemplate').html();
  var cal = jQuery('#tideFishCalendar').clndr({
    template: calTemplate,
    lengthOfTime: {
      intervalUnit: 'days',
      interval: 14,
      startDate: moment()
    },
    extraDateData: function(day){
      return {
        avaliable: isAvaliable( day, events )
      };
    }  
  });
  return cal;
};

/*
 * Setup prototcol to fetch data from Tide.Fish Servers
 */
function DDP( id, events, callback){
  this.id = id;
  this.ddp = new MeteorDdp('ws://localhost:3000/websocket');
  this.callback = callback;
  this.events = events;
  this.subscribedTo = {};
  this.connected = false;
  this._startupQueue = [];
  var self = this;

  self.watch();
  self.ddp.connect().done(function(){
    self.subscribe(moment());
    self.connected = true;
    _.each(self._startupQueue, function( sub ){
      self.subscribe( sub );
    });
  });
  window.onbeforeunload = function() { self.ddp.close(); }
};

/*
 * Subscribes to week passed in.
 * It converts the moment object passed in to start if ISO week before sending subscription
 */
DDP.prototype.subscribe = function(week){
  var startOfWeek = week.startOf('isoWeek');
  var key = startOfWeek.format("WWYYYY");
  if( this.subscribedTo[ key ]){ return; }
  if( !this.connected ){ this._startupQueue.push(startOfWeek.clone()); return; };
  var id = this.id;
  this.subscribedTo[key] = this.ddp.subscribe('PublicSchedule',[
      id, 
      startOfWeek.isoWeek(),
      startOfWeek.isoWeekday(6).year()
  ]);
}

DDP.prototype.watch = function() {
  var callback = this.changeCallback;
  var self = this;

  self.ddp.watch("Schedule", function(changedDoc, message){
    if( message === "added" ){
      if( !self.events[ dateKey( moment( changedDoc.date.$date ) ) ] ){
        self.events[ dateKey( moment( changedDoc.date.$date ) ) ] = {};
      }
      self.events[ dateKey( moment(changedDoc.date.$date) ) ][changedDoc.boatId] = changedDoc;
    }else if( message === "changed" ){
      self.events[ dateKey( moment( changedDoc.date.$date)) ][changedDoc.boatId] = changedDoc;
    }else if( message === "removed" ){
      delete events[ dateKey( moment(changedDoc.date.$date)) ][changedDoc.boatId];
    }
    self.callback();
  }); 
};

/*
 * Object representing the events section of the widget
 */
function EventsDisplay(events){
  this.date = moment();
  this.events = events;

  this.template = _.template(
      jQuery('script#tideFishEventsDisplay').html()
  );

  this.render();

  return this;
};

EventsDisplay.prototype.render = function(){
  var data = {
    events: this.events[ dateKey(this.date) ],
    date: this.date
  };
  jQuery('#tideFishEvents').html( this.template( data ) );
};

EventsDisplay.prototype.setDate = function( date ){
  this.date = date;
  this.render();
};

/*
 * Helper functions for widget
 */
function dateKey( date ){
  return date.format("MM/DD/YYYY");
};

function isAvaliable( day, events ){
  var avaliable = false;
  _.each( events[dateKey(day)], function( e ){
    if( e.avaliable.length > 0 ){
      avaliable = true;
    }
  });
  return avaliable;
};


/******** Our main function ********/
function main() { 
    init();
    jQuery(document).ready(function($) {
        var id = jQuery('#tideFishSchedule').attr('data-accountId');
        jQuery('#tideFishSchedule').append('<div id="tideFishCalendar"></div><div id="tideFishEvents"></div>');

        var events = {};

        var eventsDisplay = new EventsDisplay(events);
        
        // Setup Calendar and attach data callbacks
        var cal = SetupCalendar(events);
        cal.options.clickEvents.onSelect = function(day){
          eventsDisplay.setDate( day );
        }

        var ddp = new DDP( id , events, function(){
          cal.render();
          eventsDisplay.render();
        });

        // When the interval changes on the calendar we may need more data
        cal.options.clickEvents.onIntervalChange = function(start, end){
          for( var date = start.clone(); !date.isAfter(end,'isoWeek'); date.add(1,'week') ){
            ddp.subscribe( date.clone() );
          }
        }

        // since intervalChange hook was set after cal init, we need to trigger first time
        cal.options.clickEvents.onIntervalChange( cal.intervalStart, cal.intervalEnd );
        
    });
}

})(); // We call our anonymous function immediately
