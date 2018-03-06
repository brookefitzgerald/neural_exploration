function dataLoad(url) {
    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.setRequestHeader('Content', 'application/JSON');
        request.responseType="json";
        request.onload = function() {
            if (request.status === 200) {
                resolve(request.response);
            } else {
                reject(Error('Data didn\'t load successfully; error code:' + request.statusText));
            }
        };
        request.onerror = function() {
            reject(Error('There was a network error.'));
        };
        request.send();
    });
};
/*
dataLoad('http://localhost:8000/spike/data/1/').then(
    function(response) {
        var data = JSON.parse(response);
        d3.select("div#container")
        .append("p")
        .attr("id", "myNewParagrap")
        .append("text")
        .text(data.trial_number);
    }, function(Error) {
        console.log(Error);
    });

dataLoad('http://localhost:8000/spike/data/2/').then(
    function(response) {
        var data = JSON.parse(response);
        d3.select("div#container")
        .append("p")
        .attr("id", "myNewParagrap")
        .append("text")
        .text(data.trial_number);
    }, function(Error) {
        console.log(Error);
    });*/
