(function() {
var _;

var loaded = {
  underscore: false,
  jQuery: false,
  moment: false,
  ddp: false,
  cal: false,
  template1: false,
  template2: false
};

var loading = {
  underscore: false,
  jQuery: false,
  moment: false,
  ddp: false,
  cal: false,
  template1: false,
  template2: false
};

function depHandler(){
  if( !loading.underscore && !loading.jQuery ){
    loading.jQuery = true;
    loadJQuery();
    loading.underscore = true;
    loadUnderscore();
  }else if( loaded.underscore && loaded.jQuery && !loading.moment){
    loading.moment = true;
    loadMoment();
    loading.ddp = true;
    loadDdp();
    loading.template1 = true;
    loadCalTemp1();
    loading.template2 = true;
    loadCalTemp2();
    loadCss();
  }else if( loaded.moment && loaded.ddp && !loading.cal ){
    loading.cal = true;
    loadCal();
  }else if( loaded.cal && loaded.ddp && loaded.template1 && loaded.template2){
    main(jQuery );
  };
};

function jQueryLoadHandler( ) {
  loaded.jQuery = true;
  depHandler();
};
function underscoreLoadHandler( ) {
  loaded.underscore = true;
  _ = window._;
  depHandler();
};
function momentLoadHandler( ) {
  loaded.moment = true;
  depHandler();
};
function calLoadHandler( ) {
  loaded.cal = true;
  depHandler();
};
function ddpLoadHandler( ) {
  loaded.ddp = true;
  depHandler();
};


function loadLib( url, callback ){
  var script_tag = document.createElement('script');
  script_tag.setAttribute("type","text/javascript");
  script_tag.setAttribute("src", url );
  if (script_tag.readyState) {
    script_tag.onreadystatechange = function () { // For old versions of IE
        if (this.readyState == 'complete' || this.readyState == 'loaded') {
          callback();
        }
    };
  } else { // Other browsers
    script_tag.onload = callback;
  }
  // Try to find the head, otherwise default to the documentElement
  (document.getElementsByTagName("head")[0] || document.documentElement).appendChild(script_tag);
};

function loadUnderscore(){
  if (window._ === undefined ) {
    loadLib( "https://s3.amazonaws.com/tidefish-widget/underscore.min.js", underscoreLoadHandler );
  } else {
    underscoreLoadHandler();
  }
};

function loadJQuery(){
  if (window.jQuery === undefined || window.jQuery.fn.jquery !== '1.11.1') {
    loadLib( "https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.js", jQueryLoadHandler );
  } else {
    jqueryLoadHandler();
  }
};

function loadMoment(){
  if (window.moment === undefined ) {
    loadLib( "https://s3.amazonaws.com/tidefish-widget/moment.min.js", momentLoadHandler );
  } else {
    momentLoadHandler();
  }
};

function loadDdp(){
  loadLib(  "https://s3.amazonaws.com/tidefish-widget/meteor-ddp.min.js", ddpLoadHandler );
  loaded.ddp = true;
};

function loadCal(){
  loadLib( "https://s3.amazonaws.com/tidefish-widget/cal.min.js", calLoadHandler );
  loaded.cal = true;
};

function loadCss(){
  $('head').append( '<link rel="stylesheet" href="https://s3.amazonaws.com/tidefish-widget/style.min.css">' );
};

var scheduleTempText;
function loadCalTemp1(){
  $.get("https://s3.amazonaws.com/tidefish-widget/widget-schedule-template.html", function(text){
    scheduleTempText = text;
    loaded.template1 = true;
    depHandler();
  });
};

var calTempText;
function loadCalTemp2(){
  $.get( "https://s3.amazonaws.com/tidefish-widget/widget-cal-template.html", function(text){
    calTempText = text;
    loaded.template2 = true;
    depHandler();
  });
};

depHandler();

/******** Library startup helpers ******/

/*
 * Create calendar object and helpers
 */
function SetupCalendar( events ){
  var cal = jQuery('#tideFishCalendar').clndr({
    template: calTempText,
    onRender: function(){
      var self = this;
      $('#jumpToDateSubmit').click(function(e){
        var date = moment($('#jumpToDateInput').val());
        if( date.isValid() ){
          self.setSelected( date, false );
          self.applyChange( date );
        }
        $('#jumpToDateInput').val('');
      });
    },
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
function DDP( id, events, callback, ws ){
  this.id = id;
  if( ws ){
    this.ddp = new MeteorDdp(ws);
  }else{
    this.ddp = new MeteorDdp('wss://tide.fish/websocket');
  }
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
  this.template = _.template( scheduleTempText );

  this.render();

  return this;
};

EventsDisplay.prototype.render = function(){
  var data = {
    events: this.events[ dateKey(this.date) ],
    date: this.date
  };
  $('#tideFishEvents').html( this.template( data ) );
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
function main($) {
  
    $(document).ready(function($) {
        var id = jQuery('#tideFishSchedule').attr('data-accountId');
        if( !id ){ 
          console.error( "data-accountId not defined on #tideFishSchedule" ) 
        }else{
          jQuery('#tideFishSchedule').append('<div id="tideFishCalendar"></div><div id="tideFishEvents"></div>');

          var events = {};

          var eventsDisplay = new EventsDisplay(events);
          
          // Setup Calendar and attach data callbacks
          var cal = SetupCalendar(events);
          cal.options.onSelect = function(day){
            eventsDisplay.setDate( day );
          }

          var ws = jQuery('#tideFishSchedule').attr('data-ws');
          var ddp = new DDP( id , events, function(){
            cal.render();
            eventsDisplay.render();
          }, ws);

          // When the interval changes on the calendar we may need more data
          cal.options.clickEvents.onIntervalChange = function(start, end){
            var endBound = end.clone().add(5,'days');
            for( var date = start.clone(); !date.isAfter(endBound,'isoWeek'); date.add(1,'week') ){
              ddp.subscribe( date.clone() );
            }
          }

          // since intervalChange hook was set after cal init, we need to trigger first time
          cal.options.clickEvents.onIntervalChange( cal.intervalStart, cal.intervalEnd );
        }
    });
}

})(); // We call our anonymous function immediately
