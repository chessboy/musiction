function ApiClient() {}

ApiClient.prototype.request = function(urlString, callback, param) {
    var self = this;

    var myRequest = new Request({
        url: urlString,
        method: 'get',
        onRequest: function() {
            //console.log('loading: ' + urlString);
        },

        onSuccess: function(responseText) {
            //console.log("ApiClient received: " + responseText);
            callback(responseText, param);
        },

        onFailure: function() {
            console.log('error');
        }
    });

    myRequest.send();
}