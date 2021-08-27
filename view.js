"use strict";

var js_pcb = js_pcb || {};
(function()
{
	// ffy comment: show_result: 1 for show, 0 for not show (in broswer console)
	function view_pcb(pcb_data, scale, margin, show_result)
	{
		//Width and height etc
		let width, height, depth;
		[width, height, depth] = pcb_data[0];

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
		for (let layer = 0; layer < depth; ++layer)
		{
			layers.push(pcb.append("g")
				.attr("stroke", layer_colors[layer % layer_colors.length])
				.attr("stroke-opacity", 0.75));
		}
		layers.push(pcb.append("g")
			.attr("stroke", "white"));

		// ffy comment: Add variable for calculating via number and approximate wire length
		let wire_length = 0, via_num = 0, close_pair = 0, parallel_wire = 0;
		let w = ( margin * scale * 2 + width * scale);
		let h = ( margin * scale * 2 + height * scale);
		let via_map = new Int8Array(w * h);

		//add tracks
		for (let track of pcb_data[1])
		{
			let track_radius, paths;
			[track_radius, , , , paths] = track;
			for (let path of paths)
			{
				// ffy comment: path[0] = first node's [x, y, z] ... 
				let node, start = 0, check_p_up = 0, check_p_down = 0;
				let d = path[start][2];
				for (node = 1; node < path.length; ++node)
				{
					if (path[node][2] === d)  {
						continue;
					}
					if (node - start > 1)
					{
						layers[d].append("path")
							.attr("stroke-width", track_radius * 2)
							.attr("d", path_func(path.slice(start, node)));
						
						wire_length += node - start;
					}
					start = node;
					d = path[start][2];
				}
				if (node - start > 1)
				{
					layers[d].append("path")
						.attr("stroke-width", track_radius * 2)
						.attr("d", path_func(path.slice(start, node)));
					
					wire_length += node - start;
				}
			}
		}

		//add terminals
		for (let track of pcb_data[1])
		{
			let track_radius, via_radius, track_gap, terminals, paths;
			[track_radius, via_radius, track_gap, terminals, paths] = track;
			for (let terminal of terminals)
			{
				let terminal_radius, terminal_gap, terminal_x, terminal_y, terminal_z, terminal_shape;
				[terminal_radius, terminal_gap, [terminal_x, terminal_y, terminal_z],  terminal_shape] = terminal;
				if (!terminal_shape.length)
				{
					layers[layers.length-1].append("circle")
						.attr("cx", terminal_x)
						.attr("cy", terminal_y)
						.attr("r", terminal_radius)
						.attr("fill", "white");
				}
				else if (terminal_shape.length === 2)
				{
					layers[layers.length-1].append("path")
						.attr("stroke-width", terminal_radius * 2)
						.attr("d", path_func(terminal_shape.map(
							function(e){ return [e[0] + terminal_x, e[1] + terminal_y]; })));
				}
				else
				{
					layers[layers.length-1].append("path")
						.attr("fill", "white")
						.attr("d", path_func(terminal_shape.map(
							function(e){ return [e[0] + terminal_x, e[1] + terminal_y]; })));
				}
			}
			// add vias
			for (let path of paths)
			{
				let terminal_z = path[0][2];
				for (let node = 1; node < path.length; ++node)
				{
					if (terminal_z !== path[node][2])
					{
						layers[layers.length-1].append("circle")
							.attr("cx", path[node][0])
							.attr("cy", path[node][1])
							.attr("r", via_radius)
							.attr("fill", "gray");
						
						let pos_x = path[node][0];
						let pos_y = path[node][1];
						// ffy comment: It is only for 2 layer
						for(let i = 1; i < 4; ++i) {
							for(let j = 0; j <= i; ++j) {
								let k = i - j;
								if(via_map[(pos_y - k) * w + pos_x - j] == 1) {
									close_pair += 1;
								}
								if(via_map[(pos_y - k) * w + pos_x + j] == 1) {
									close_pair += 1;
								}
								if(via_map[(pos_y + k) * w + pos_x - j] == 1) {
									close_pair += 1;
								}
								if(via_map[(pos_y + k) * w + pos_x + j] == 1) {
									close_pair += 1;
								}
							}
						}
						via_map[pos_y * w + pos_x] = 1;
						via_num += 1;
					}
					terminal_z = path[node][2];
				}
			}
		}

		// ffy comment: output via number and wire length to console
		if(show_result == 1) {
			console.log("approximate wire length = " + wire_length);
			console.log("via number = " + via_num);
			console.log("close via pair = " + close_pair);
		}
	}

	js_pcb.view_pcb = view_pcb;
})();
