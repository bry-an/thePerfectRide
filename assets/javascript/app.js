//our global variables
var config = {
  apiKey: "AIzaSyCXOmd8axz487uA0HD-ghajDqKsxctSMjQ",
  authDomain: "windwatch-1bbdd.firebaseapp.com",
  databaseURL: "https://windwatch-1bbdd.firebaseio.com",
  projectId: "windwatch-1bbdd",
  storageBucket: "windwatch-1bbdd.appspot.com",
  messagingSenderId: "580451818625"
};
firebase.initializeApp(config);
var database = firebase.database();


var routeArray = [];
var map;
var weatherMarkers = [];
var clickedMarkers = [];
var startEndMarkers = [];
var headingsArr = [];
var forecastArr = [];
var errorFlag = false;
var count = 0;
var headWind = [];

function initMap() {
  //new DirectionsRenderer class, which renders the route, passing our setting
  var directionsDisplay = new google.maps.DirectionsRenderer({
    draggable: true,
    map: map,

  });
  var directionsService = new google.maps.DirectionsService();
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: { lat: 39.74, lng: -104.99 }
  });

  var startInput = document.getElementById('start');
  var endInput = document.getElementById('end');
  var startInfowindowContent = document.getElementById('startInfowindow-content')
  var endInfowindowContent = document.getElementById('endInfowindow-content')

  getAutocomplete(startInput, startInfowindowContent);
  getAutocomplete(endInput, endInfowindowContent);

  directionsDisplay.setMap(map);
  directionsDisplay.setPanel(document.getElementById('right-panel'));

  //handles button click event
  var onChangeHandler = function () {
    calculateAndDisplayRoute(directionsService, directionsDisplay);
  };
  //handles drag events
  var dragHandler = function () {
    computeTotalDistance(directionsDisplay.getDirections());
    console.log("drag handler");
    recalculateDisplayedRoute(directionsDisplay);
    count = 0;
    headWind = [];
  }

  // document.getElementById('get-weather').addEventListener('click', onChangeHandler);
  $("#get-weather").on("click", function (event) {
    // document.getElementById('get-weather').addEventListener('click', function (event){
    event.preventDefault();

    var routeStart = $("#start").val().trim();
    var destination = $("#end").val().trim();
    var routeStore = {
      start: routeStart,
      finish: destination
    }
    console.log(routeStore);
    database.ref().push(routeStore);
    onChangeHandler()
  });
  directionsDisplay.addListener('directions_changed', dragHandler);
  google.maps.event.addListener(map, 'click', (event) => placeWeatherMarker(event.latLng));
}
//triggered by either dragging the route or creating a new one. 
function recalculateDisplayedRoute(directionsDisplay) {
  console.log("recalculate displayed route");
  var weatherPoints = document.getElementById('weather-points').value;
  var newRoute = directionsDisplay.getDirections();
  var newPointsArr = newRoute.routes[0].overview_path;
  headingsArr = [];
  getAll(weatherPoints, newPointsArr);
  wind = [];

}
//grabs 'start' and 'end' values from user input, passes to directionsService.route() method
//if successful, returns a massive response object that contains the route
//if not, throws error and adds message to DOM. 
function calculateAndDisplayRoute(directionsService, directionsDisplay) {
  var start = document.getElementById('start').value;
  var end = document.getElementById('end').value;
  document.getElementById('start').value = "";
  document.getElementById('end').value = "";
  var weatherPoints = document.getElementById('weather-points').value;

  directionsService.route({
    origin: start,
    destination: end,
    travelMode: 'BICYCLING'
  }, function (response, status) {
    if (status === 'OK') {
      var pointsArr = response.routes[0].overview_path;
      directionsDisplay.setDirections(response);
      if (errorFlag) {
        $("#error").empty();
      }
    } else {
      var error = $("<div id = 'error'>Please enter a valid location</div>");
      $("#route-entry").append(error);
      errorFlag = true;
    }
  });
}

//mother function: activated indirectly by clicking on get-route button
//accepts the number of intervals the user wants weather at and an array of points given by the
//response from the directionsService.route() method. 
//It iterates through the position array, grabs values at a specified interval, and passes
//those values to the big three functions in this app: getMarker and either getWeather or getForecast
function getAll(numOfIntervals, array) {
  console.log("get all");
  clearSummaryPanel();
  deleteMarkers(weatherMarkers);
  weatherMarkers = [];
  //display summary panel
  $("#summary-panel").css("display", "inline");
  $("#right-panel").css("display", "inline");
  var interval = Math.floor(array.length / numOfIntervals);
  for (var i = 0; i < array.length; i++) {
    if (i % interval == 0) {
      count++;
      if (count > numOfIntervals) {
        console.log("too much!");
        return;
      }

      var intervalLat = array[i].lat;
      var intervalLng = array[i].lng;
      //interval_Next variables are used to compute heading. We're grabbing the i+1 position
      //to compare it to i to determine heading. However, if i is the last element, the engine
      //understandably throws an error when accessing i+1. So the if statement will compare the 
      //last point with second-to-last.
      if (i == array.length - 1) {
        intervalLatNext = array[i - 1].lat;
        intervalLngNext = array[i - 1].lat;
      }
      else {
        var intervalLatNext = array[i + 1].lat;
        var intervalLngNext = array[i + 1].lng;
      }
      var pointLatLng = new google.maps.LatLng(intervalLat(), intervalLng());
      var nextPointLatLng = new google.maps.LatLng(intervalLatNext(), intervalLngNext());

      var heading = google.maps.geometry.spherical.computeHeading(pointLatLng, nextPointLatLng);
      //because Google is wack and displays headings ranging from -180 to +180. But the rest of the world
      //uses 0-360. This fixes that. 
      if (heading < 0) {
        heading += 360;
      }
      headingsArr.push(heading);

      getMarker(intervalLat(), intervalLng());
      if ($("#forecast-times").val() == 0)
        getWeather(intervalLat(), intervalLng(), appendWeatherToSummary);
      else getForecast(intervalLat(), intervalLng(), appendForecastToSummary);
    }
  };
}
//drops a marker on the map at given lat, lng
function getMarker(lat, lng) {
  var selectedMarkerIndex;
  var marker = new google.maps.Marker({
    position: { lat: lat, lng: lng },
    map: map,
    animation: google.maps.Animation.DROP
  })
  weatherMarkers.push(marker);
  marker.addListener("mouseover", (event) => {
    console.log("mouseover")
    weatherMarkers.forEach(function (marker, index) {
      if (marker.position.lat() == event.latLng.lat()) {
        selectedMarkerIndex = index;
        highlightSummaryDiv(index, "white");
      }
    })
  })

  marker.addListener("mouseout", (event) => {
    console.log("mouseout");
    highlightSummaryDiv(selectedMarkerIndex, "#4db6ac");
  })

}

//a little math to compute how much of the wind is a headwind, given wind speed, direction, and user's heading
//returns positive number for headwind; negative for tailwind
function calculateHeadwindComponent(windSpd, windDr, hdg) {
  windDirRad = windDr * Math.PI / 180;
  headingRad = hdg * Math.PI / 180;
  return windSpd * Math.cos(headingRad - windDirRad);
}


//ajax request to get current weather
function getWeather(lat, lng, callback) {
  console.log("get weather");
  var queryURL = "https://api.openweathermap.org/data/2.5/weather?APPID=1af38fcbab6d390a11b52f1a3c19fe7f&units=imperial&lat=" + lat + "&lon=" + lng;
  $.ajax({
    url: queryURL,
    method: "GET",
  }).then(callback);
}
//need another damn ajax request to get weather because openweathermap doesn't provide forecast specifications in query string
function getForecast(lat, lng, callback) {
  var queryURL = "https://api.openweathermap.org/data/2.5/forecast?APPID=1af38fcbab6d390a11b52f1a3c19fe7f&units=imperial&lat=" + lat + "&lon=" + lng;
  $.ajax({
    url: queryURL,
    method: "GET",
  }).then(callback);
}

//callback to get list of available times from forecast API
function getForecastTimes(response) {
  forecastArr.push("Now!");
  response.list.forEach(function (item) {
    var formattedTime = moment.unix(item.dt).format('ddd, MMM Do, h:mma');
    forecastArr.push(formattedTime);

  });
  var s = $("<select />").attr("id", "forecast-times").attr("name", "forecast-times");
  for (var i = 0; i < forecastArr.length; i++) {
    var newItem = $("<option value=" + i + ">" + forecastArr[i] + "</option>");
    $(s).append(newItem);
  }
  $("#forecast-time-select").append(s);
}

var wind = [];
//callback function for getWeather that puts the weather details on the summary pane
function appendWeatherToSummary(response) {
  console.log("append weather");
  var heading = headingsArr.shift();
  var desc = response.weather[0].description;
  var temp = response.main.temp;
  var windSpeed = response.wind.speed;
  var windDir = response.wind.deg;
  var icon = "<img id='condition-icon' src = 'http://openweathermap.org/img/w/" + response.weather[0].icon + ".png'/>";
  var panelDiv = $("#summary-panel");
  var headwindComponent = calculateHeadwindComponent(windSpeed, windDir, heading);
  var item = $("<div class = 'summary-item'>");
  $(panelDiv).append(item);
  // $(item).append(icon + "<br>");
  $(item).append(icon + "<br>");
  $(item).append("<img id='temp-icon' src='assets/images/thermometer.png'>&nbsp&nbsp<span class='text-display'>" + temp + "&deg F </span><br>");
  $(item).append("<img id='direction-icon' src='assets/images/wind-direction.svg'>&nbsp&nbsp&nbsp<span class='text-display'>" + windSpeed + " mph</span><br>");
  $(item).append("<img id='direction-icon' src='assets/images/compass-icon.png'>&nbsp&nbsp<img id='direction-icon' src='assets/images/wind-direction.svg'>&nbsp&nbsp&nbsp<span class='text-display'>" + windDir.toFixed(2) + "&deg</span><br>");
  $(item).append("<img id='direction-icon' src='assets/images/compass-icon.png'>&nbsp<img id='biker-icon' src='assets/images/biker.png'>&nbsp&nbsp&nbsp<span class='text-display'>" + heading.toFixed(2) + "&deg<br>");
  $(item).append("<span class = 'text-display'>Headwind: </span>" + headwindComponent.toFixed(2) + " mph");
  wind.push(windSpeed);
  headWind.push(headwindComponent);
}
//callback function for getForecast that puts the forecast (future weather) details on the summary pane
function appendForecastToSummary(response) {
  var heading = headingsArr.shift();
  var forecastIndex = ($("#forecast-times").val() - 1); //since index 0 has "Now!", need to substract one to get time selected index
  var forecast = response.list[forecastIndex];
  console.log(forecast.dt);
  var desc = forecast.weather[0].description;
  var temp = forecast.main.temp;
  var windSpeed = forecast.wind.speed;
  var windDir = forecast.wind.deg;
  var icon = "<img src = 'http://openweathermap.org/img/w/" + forecast.weather.icon + ".png'/>";
  var panelDiv = $("#summary-panel");
  var headwindComponent = calculateHeadwindComponent(windSpeed, windDir, heading);
  var item = $("<div class = 'summary-item'>");
  $(panelDiv).append(item);
  // $(item).append(icon + "<br>");
  $(item).append("<img id='temp-icon' src='assets/images/thermometer.png'>&nbsp&nbsp<span class='text-display'>" + temp + " &deg F </span><br>");
  $(item).append("<img id='direction-icon' src='assets/images/wind-direction.svg'>&nbsp&nbsp&nbsp<span class='text-display'>" + windSpeed + " mph</span><br>");
  $(item).append("<img id='direction-icon' src='assets/images/compass-icon.png'>&nbsp<img id='direction-icon' src='assets/images/wind-direction.svg'>&nbsp&nbsp&nbsp<span class='text-display'>" + windDir.toFixed(2) + "&deg</span><br>");
  $(item).append("<img id='direction-icon' src='assets/images/compass-icon.png'>&nbsp<img id='biker-icon' src='assets/images/biker.png'>&nbsp&nbsp&nbsp<span class='text-display'>" + heading.toFixed(2) + "&deg<br>");
  $(item).append("<span class = 'text-display'>Headwind: </span>" + headwindComponent.toFixed(2) + " mph");
}


  function windWatch(wind) {
    if (wind > 1 && wind <= 10) {
      // html turns green
      $("#windWatch").css("background", "rgba(76, 175, 80, 0.6)")
    };
    if (wind > 10.1 && wind <= 20) {
      // html turns yellow
      $("#windWatch").css("background", "rgba(255,255,0, 0.5)")
    }
    if (wind > 20.1) {
      // document.write("got it"), html turns red
      $("#windWatch").css("background", "rgba(255, 0, 0, 0.6)")
    };
  }

  function windWatch2(headWind) {
    for (var i = 0; i < headWind.length; i++) {
      if (headWind[i] > 1) {
        var divOfInterest = document.getElementById("summary-panel").children[i];
        $(divOfInterest).css("background", "rgba(255, 0, 0, 0.6)")
        console.log(divOfInterest);
      }
    };
  }
function clearSummaryPanel() {
  $("#summary-panel").empty();
}

//helper function for deleteMarkers
function setMapOnAll(map, markerArray) {
  for (var i = 0; i < markerArray.length; i++) {
    markerArray[i].setMap(map);
  }
}
//deletes markers in specified marker array
function deleteMarkers(markerArray) {
  console.log("delete markers");
  setMapOnAll(null, markerArray);
  markerArray = [];

}
//function to encapsulate Google's autocomplete classes/methods for form autocomplete
function getAutocomplete(input, infowindowContent) {

  var autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.bindTo('bounds', map);
  autocomplete.setFields(['address_components', 'geometry', 'icon', 'name']);
  var infowindow = new google.maps.InfoWindow();
  var marker = new google.maps.Marker({
    map: map,
    anchorPoint: new google.maps.Point(0, -29)
  });

  autocomplete.addListener('place_changed', function () {
    infowindow.close();
    marker.setVisible(false);
    var place = autocomplete.getPlace();
    marker.setPosition(place.geometry.location);
    marker.setVisible(true);
    startEndMarkers.push(marker);
    map.panTo(place.geometry.location);
    map.setZoom(12);  // Why 17? Because it looks good.

    var address = "";
    if (place.address_components) {
      address = [
        (place.address_components[0] && place.address_components[0].short_name || ''),
        (place.address_components[1] && place.address_components[1].short_name || ''),
        (place.address_components[2] && place.address_components[2].short_name || '')
      ].join(' ');
    }
  });
}
//drops a marker with an InfoWindow containing the current weather at that location
function placeWeatherMarker(location) {
  console.log(location);
  var clickedMarker = new google.maps.Marker({
    position: location,
    map: map
  });
  clickedMarkers.push(clickedMarker);
  getWeather(location.lat(), location.lng(), function (response) {
    var latitude = location.lat();
    var longitude = location.lng();
    var desc = response.weather[0].description;
    var temp = response.main.temp;
    var windSpeed = response.wind.speed;
    var windDir = response.wind.deg;
    var icon = "<img src = 'http://openweathermap.org/img/w/" + response.weather[0].icon + ".png'/>";
    var popupContent = "<p class = 'popupText'><strong>Weather here: </strong><br>" +
      "Temperature: " + temp + "<br>" +
      "Wind Speed: " + windSpeed + "<br>" +
      "Wind Direction: " + windDir + "<br></p>";
    var weatherInfoWindow = new google.maps.InfoWindow({
      content: popupContent
    });
    weatherInfoWindow.open(map, clickedMarker)
  })
}
//sets the bounds of the map to include all markers passed in an array to the function
function setBounds(markerArray) {
  var bounds = new google.maps.LatLngBounds();
  for (var i = 0; i < markerArray.length; i++) {
    bounds.extend(markerArray[i].getPosition())
  }
  map.fitBounds(bounds);
}
//drops a weather marker at specified latLng object (location)
function placeWeatherMarker(location) {
  console.log(location);
  var clickedMarker = new google.maps.Marker({
    position: location,
    map: map
  });
  clickedMarkers.push(clickedMarker);
  if ($("#forecast-times").val() == 0) {
    getWeather(location.lat(), location.lng(), function (response) {
      var latitude = location.lat();
      var longitude = location.lng();
      var desc = response.weather[0].description;
      var temp = response.main.temp;
      var windSpeed = response.wind.speed;
      var windDir = response.wind.deg;
      var icon = "<img src = 'http://openweathermap.org/img/w/" + response.weather[0].icon + ".png'/>";
      var popupContent = "<p class = 'popupText'><strong>Weather here: </strong><br>" +
        "Temperature: " + temp + "<br>" +
        "Wind Speed: " + windSpeed + "<br>" +
        "Wind Direction: " + windDir + "<br></p>";
      var weatherInfoWindow = new google.maps.InfoWindow({
        content: popupContent
      });
      weatherInfoWindow.open(map, clickedMarker)
    })
  }
  else {
    getForecast(location.lat(), location.lng(), function (response) {
      var forecastIndex = ($("#forecast-times").val() - 1); //since index 0 has "Now!", need to substract one to get time selected index
      var forecast = response.list[forecastIndex];
      console.log(forecast.dt);
      var desc = forecast.weather[0].description;
      var temp = forecast.main.temp;
      var windSpeed = forecast.wind.speed;
      var windDir = forecast.wind.deg;
      var popupContent = "<p class = 'popupText'><strong>Weather here will be: </strong><br>" +
        "Temperature: " + temp + "<br>" +
        "Wind Speed: " + windSpeed + "<br>" +
        "Wind Direction: " + windDir.toFixed(2) + "<br></p>";
      var weatherInfoWindow = new google.maps.InfoWindow({
        content: popupContent
      });
      weatherInfoWindow.open(map, clickedMarker)
    })

  }
}
//changes the color of one of the children in the summary panel
function highlightSummaryDiv(index, color) {
  var divOfInterest = document.getElementById("summary-panel").children[index];
  $(divOfInterest).css("background-color", color);

}
function computeTotalDistance(result) {
  var total = 0;
  var myroute = result.routes[0];
  for (var i = 0; i < myroute.legs.length; i++) {
    total += myroute.legs[i].distance.value;
  }
  total = total / 1000;
  total = total * 0.6213 //convert to miles because this is America.
  document.getElementById('total').innerHTML = total.toFixed(2) + ' mi';
}


$(document).ready(function () {
  //call to get list of available forecast times
  getForecast(39.739, 104.99, getForecastTimes);

  $("#clearMarkersBtn").on("click", function () {
    console.log("clickey click");
    deleteMarkers(clickedMarkers);
  })

$("#windWatch").on("click", function (event) {
  windWatch(wind[0]);
  windWatch2(headWind);
});
})
