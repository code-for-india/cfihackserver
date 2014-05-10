
var Parse = require('parse').Parse;

var REPORT_TABLE = "report";
var SCHOOL_TABLE = "school";

var FACILITY_NUMBER = 'facilityNumber';
var PARAMETER_NUMBER = 'parameterNumber';
var SCHOOL_CODE = 'schoolCode';
var SCHOOL_NAME = 'schoolName';

var LATITUDE = 'latitude';
var LONGITUDE = 'longitude';

var TRUE = 'true';
var FALSE = 'false';

var FACILITY_MAPPING = {
	'1': 'Barrier-free Access',
	'2': 'Toilets',
	'3': 'Drinking Water',
	'4': 'Playground',
	'5': 'Library'
}

var FE_FACILITY_MAPPING = {
	'1': 'barrier',
	'2': 'toilets',
	'3': 'drinkingWater',
	'4': 'playground',
	'5': 'library'
}


Parse.initialize("3P4Yf9CyJU9up39DrDEvfxrEkBXFvqkTopkSJRNl", "002iMIHr3Ul7Ee9dv8B2QsHXHDZmOzatqds6tJIZ");

exports.addReport = function(data, callback) {
	var Report = Parse.Object.extend("report");

	var reportInstance = new Report();
	reportInstance.set("facilityNumber", 4);
	reportInstance.set("parameterNumber", 2);
	reportInstance.set("fileName", "savingPrivateRyan.jpg");
	reportInstance.set("comments", "This is a comment");
	reportInstance.set("schoolCode", "24010308901");

	reportInstance.save(null, {
		success: function(reportInstance) {
    		console.log('New object created with objectId: ' + reportInstance.id);
    		callback.send(200);
		},
		error: function(reportInstance, error) {
    		console.log('Failed to create new object, with error code: ' + error.description);
		}
	});
}

/*	
Parse.Cloud.define("aggregateCountByType", function(request, response) {
	var query = new Parse.Query("report");
	query.equalTo("")
}
*/

exports.aggregateByAType = function(data, callback) {
	var Report = Parse.Object.extend(REPORT_TABLE);
	var School = Parse.Object.extend(SCHOOL_TABLE);

	var type = data.query.typeKey;
	var name = data.query.typeValue;
	var subType = data.query.subType;

	var schoolCodeQuery = new Parse.Query(School);
	schoolCodeQuery.equalTo(type, name);
	schoolCodeQuery.find({
		success: function(results) {
			var schoolCodes = [];
			var subTypeValues = {};
			for(var i = 0 ; i < results.length; i++) {
				var schoolObject = results[i];
				schoolCodes.push(schoolObject.get(SCHOOL_CODE));
				if(!(schoolObject.get(subType) in subTypeValues)) {
					subTypeValues[schoolObject.get(subType)] = 1;
				}
			}

			if(schoolCodes.length > 0) {
				var reportQuery = new Parse.Query(Report);
				reportQuery.containedIn(SCHOOL_CODE, schoolCodes);
				reportQuery.find({
					success: function(reports) {
						var output = {};
						for(var i = 0; i < reports.length; i++) {
							var reportInstance = reports[i];
							var fn = reportInstance.get(FACILITY_NUMBER);
							var pn = reportInstance.get(PARAMETER_NUMBER);
							if(!(fn in output)) {
								output[fn] = {};
							}
							if(!(pn in output[fn])) {
								output[fn][pn] = 1;
							} else {
								output[fn][pn] += 1;
							}
						}
						var finalOutput = { 'type': type, 'name': name, "subtype": {'name': subType, 'values': Object.keys(subTypeValues)} };
						var facilities = [];
						for(var key in output) {
							var params = { 'name': FACILITY_MAPPING[key] };
							params['problems'] = output[key];
							facilities.push(params);
						}
						finalOutput['facilities'] = facilities;
						callback.send(finalOutput);
					},
					error: function(error) {
						console.log("Error in Report query - " + error.code + " - " + error.message);
					}
				})
			} else {
				callback.send("{}");
			}
		},
		error: function(error) {
			console.log("Error - " + error.code + " - " + error.message);
			callback.send("{}");
		}
	});

}


exports.fetchHeatMapCoordinates = function(data, callback) {
	var Report = Parse.Object.extend(REPORT_TABLE);
	var reportQuery = new Parse.Query(REPORT_TABLE);
	var facilities = [];
	if(data.query.barrier == TRUE)
		facilities.push(1);
	if(data.query.toilets == TRUE)
		facilities.push(2);
	if(data.query.drinkingWater == TRUE)
		facilities.push(3);
	if(data.query.playground == TRUE)
		facilities.push(4);
	if(data.query.library == TRUE)
		facilities.push(5);
	if(facilities.length > 0) {
		reportQuery.containedIn(FACILITY_NUMBER, facilities);
		reportQuery.find({
			success: function(reports) {
				var schoolCodes = {};
				for(var i = 0; i < reports.length; i++) {
					var reportInstance = reports[i];
					if(reportInstance.get(SCHOOL_CODE) in schoolCodes) {
						schoolCodes[reportInstance.get(SCHOOL_CODE)] += 1;
					} else {
						schoolCodes[reportInstance.get(SCHOOL_CODE)] = 1;
					}
				}
				var schoolQuery = new Parse.Query(SCHOOL_TABLE);
				schoolQuery.containedIn(SCHOOL_CODE, Object.keys(schoolCodes));
				schoolQuery.find({
					success: function(schools) {
						var schoolKeys = Object.keys(schoolCodes);
						var locations = [];
						for(var i =0 ; i < schools.length; i++) {
							var schoolInstance = schools[i];
							var count = schoolCodes[schoolInstance.get(SCHOOL_CODE)];
							for(var j = 0 ; j < count; j++) {
								locations.push({"lat": schoolInstance.get(LATITUDE), "lng": schoolInstance.get(LONGITUDE)});
							}
						}
						callback.send({"locations": locations});
					},
					error: function(error) {
						console.log("Error - " + error.code + " - " + error.message);
						callback.send("{}");
					}
				});
			},
			error: function(error) {
				console.log("Error - " + error.code + " - " + error.message);
				callback.send("{}");
			}
		});
	} else {
		console.log("Specified all filters as FALSE. No data to work.");
		callback.send("{}");
	}

}


exports.fetchPinMapData = function(data, callback) {
	var reportQuery = new Parse.Query(REPORT_TABLE);
	reportQuery.find({
		success: function(reports) {
			var schoolMap = {};
			for(var i = 0; i < reports.length; i++) {
				var reportInstance = reports[i];
				if(!(reportInstance.get(SCHOOL_CODE) in schoolMap)) {
					schoolMap[reportInstance.get(SCHOOL_CODE)] = {};
				}
				var ref = schoolMap[reportInstance.get(SCHOOL_CODE)];
				var facilityString = FE_FACILITY_MAPPING[reportInstance.get(FACILITY_NUMBER)];
				if(!(facilityString in ref)) {
					ref[facilityString] = {"open": 0, "resolved": 0};
				}
				if(reportInstance.get("status") == "OPEN") {
					ref[facilityString]["open"] += 1;
				} else {
					ref[facilityString]["resolved"] += 1;
				}
			}
			var schoolQuery = new Parse.Query(SCHOOL_TABLE);
			schoolQuery.containedIn(SCHOOL_CODE, Object.keys(schoolMap));
			schoolQuery.find({
				success: function(schools) {
					for(var i = 0; i < schools.length; i++) {
						var schoolInstance = schools[i];
						schoolMap[schoolInstance.get(SCHOOL_CODE)]["name"] = schoolInstance.get(SCHOOL_NAME);
						schoolMap[schoolInstance.get(SCHOOL_CODE)]["schoolCode"] = schoolInstance.get(SCHOOL_CODE);
						schoolMap[schoolInstance.get(SCHOOL_CODE)]["lat"] = schoolInstance.get(LATITUDE);
						schoolMap[schoolInstance.get(SCHOOL_CODE)]["lng"] = schoolInstance.get(LONGITUDE);
					};
					var recordsToReturn = [];
					for(var key in schoolMap) {
						recordsToReturn.push(schoolMap[key]);
					}
					callback.send({"schoolRecords": recordsToReturn});
				},
				error: function(error) {
					console.log("Report query failed in fetching pin data - " + error.message);					
				}
		});
		},
		error: function(error) {
			console.log("Report query failed in fetching pin data - " + error.message);
		}
	});
}


exports.fetchPinMapDataOld = function(data, callback) {	
	var schoolQuery = new Parse.Query(SCHOOL_TABLE);
	schoolQuery.find({
		success: function(schools) {
			var schoolMap = {};
			for(var i = 0; i < schools.length; i++) {
				var schoolInstance = schools[i];
				schoolMap[schoolInstance.get(SCHOOL_CODE)] = {
					"name" : schoolInstance.get(SCHOOL_NAME),
					"schoolCode" : schoolInstance.get(SCHOOL_CODE),
					"lat": schoolInstance.get(LATITUDE),
					"lng": schoolInstance.get(LONGITUDE)
				};
			}

			var reportQuery = new Parse.Query(REPORT_TABLE);
			reportQuery.find({
				success: function(reports) {
					var arrayToReturn = [];
					for(var i = 0; i < reports.length; i++) {
						var reportInstance = reports[i];
						var ref = schoolMap[reportInstance.get(SCHOOL_CODE)];
						console.log("Ref is " + ref);
						var facilityString = FE_FACILITY_MAPPING[reportInstance.get(FACILITY_NUMBER)];
						if(!(facilityString in ref)) {
							ref[facilityString] = {"open": 0, "resolved": 0};
						}
						if(reportInstance.get("status") == "OPEN") {
							ref[facilityString]["open"] += 1;
						} else {
							ref[facilityString]["resolved"] += 1;
						}
						arrayToReturn.push(ref);
					}
					callback.send(schoolMap);
				},
				error: function(error) {
					console.log("Report query failed in fetching pin data - " + error.message);
				}
			});
		},
		error: function(error) {
			console.log("Error in fetching pin data - " + error.message);
		}
	});
}
