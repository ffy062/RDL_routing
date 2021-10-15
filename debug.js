"use strict";

var js_pcb = js_pcb || {};
(function()
{
    
	function view_distance()
	{
		//Width and height etc
		let width, height, depth;
		//[width, height, depth] = pcb_data[0];

		let path_func = d3.line()
			.x(function(d) { return d[0]; })
			.y(function(d) { return d[1]; });
		//create/replace SVG element
		let body = d3.select("body");
		let svg = body.select("svg");
		if (svg) svg.remove();
		svg = body.append("svg")
			.attr("width", margin * scale * 2 + width * scale)
			.attr("height", margin * scale * 2 + height * scale);
		svg.append("rect")
			.attr("width", margin * scale * 2 + width * scale)
			.attr("height", margin * scale * 2 + height * scale)
			.attr("fill", "black");
		let pcb = svg.append("g")
			.attr("transform", "scale(" + scale + "," + scale + ") translate(" + margin + "," + margin + ")")
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round")
			.attr("stroke-width", "0")
			.attr("fill", "none");

		//create layers, last layer is the terminals layer
		let layers = [];
		let layer_colors = ["red", "green", "blue", "yellow", "cyan", "magenta"];
        
    }
    js_pcb.view_distance = view_distance;
})();
