"use strict";

var js_pcb_d = js_pcb_d || {};
(function() {
    function ttt() {
        let path_func = d3.line()
        .x(function(d) { return d[0]; })
        .y(function(d) { return d[1]; });

        console.log('hi');
    }
js_pcb_d.ttt = ttt;
})(); 