"use strict";


var js_pcb = js_pcb || {};
(function()
{
	
	Array.prototype.shuffle = function()
	{
		let i = this.length, j, temp;
		if (i === 0) return;
		while (--i)
		{
			j = Math.floor(Math.random() * (i + 1));
			temp = this[i];
			this[i] = this[j];
			this[j] = temp;
		}
	}

	Array.prototype.move = function(old_index, new_index)
	{
		this.splice(new_index, 0, this.splice(old_index, 1)[0]);
	}

	const spacial_hash_res = 0.75;


	//aabb of terminals
	function aabb_terminals(terms, quantization)
	{
		// ffy-comment: original : Math.trunc(terms[x][y][z]/q)
		let minx = (Math.trunc(terms[0][2][0] + 0.5) / quantization) * quantization;
		let miny = (Math.trunc(terms[0][2][1] + 0.5) / quantization) * quantization;
		let maxx = ((Math.trunc(terms[0][2][0] + 0.5) + (quantization - 1)) / quantization) * quantization;
		let maxy = ((Math.trunc(terms[0][2][1] + 0.5) + (quantization - 1)) / quantization) * quantization;
		for (let i = 1; i < terms.length; ++i)
		{
			let tminx = (Math.trunc(terms[i][2][0] + 0.5) / quantization) * quantization;
			let tminy = (Math.trunc(terms[i][2][1] + 0.5) / quantization) * quantization;
			let tmaxx = ((Math.trunc(terms[i][2][0] + 0.5) + (quantization - 1)) / quantization) * quantization;
			let tmaxy = ((Math.trunc(terms[i][2][1] + 0.5) + (quantization - 1)) / quantization) * quantization;
			minx = Math.min(tminx, minx);
			miny = Math.min(tminy, miny);
			maxx = Math.max(tmaxx, maxx);
			maxy = Math.max(tmaxy, maxy);
		}
		return [(maxx - minx) * (maxy - miny), [minx, miny, maxx, maxy]];
	}

	//set class
	class NodeSet
	{
		constructor(init)
		{
			if (init === undefined) this._data = new Map();
			else this._data = new Map(init._data.entries());
			this.size = this._data.size;
		}

		add(n)
		{
			let k = n.toString();
			if (!this._data.has(k))
			{
				this._data.set(k, n);
				this.size += 1;
			}
		}

		has(n)
		{
			return this._data.has(n.toString());
		}

		[Symbol.iterator]()
		{
			return this._data.values();
		}
	}

	//pcb class
	class Pcb
	{
		constructor(dims, rfvs, rpvs, dfunc, res, verb, quant, viascost)
		{
			let w, h, d;
			[w, h, d] = dims;
			this.m_width = w * res;
			this.m_height = h * res;
			this.m_stride = this.m_width * this.m_height;
			this.m_depth = d;
			this.m_routing_flood_vectors = rfvs;
			this.m_routing_path_vectors = rpvs;
			this.m_dfunc = dfunc;
			this.m_resolution = res;
			this.m_verbosity = verb;
			this.m_quantization = quant * res;
			this.m_viascost = viascost * res;
			this.m_layers = new js_pcb.Layers([Math.trunc(w * spacial_hash_res), Math.trunc(h * spacial_hash_res), d], spacial_hash_res / res);
			this.m_deform = new Map();
			this.m_netlist = [];
			this.m_nodes = new Uint32Array(this.m_stride * this.m_depth);
			this.m_via_vectors = [[[0, 0, -1], [0, 0, 1]], [[0, 0, -1], [0, 0, 1]]];

		}

		//add net
		add_track(track)
		{
			let track_radius, via_radius, track_gap, terminals, paths;
			[track_radius, via_radius, track_gap, terminals, paths] = track;
			this.m_netlist.push(new Net(track_radius, via_radius, track_gap, terminals, this));
		}

		//remove netlist from board
		remove_netlist()
		{
			for (let net of this.m_netlist) net.remove();
		}

		maximum_noncrossing_matching() {
			this.m_netlist.sort(function(n1, n2) {
				let n1_y = Math.trunc(n1.m_terminals[0][2][1] + 0.5);
				let n2_y = Math.trunc(n2.m_terminals[0][2][1] + 0.5);
				if(n1_y == n2_y) {
					let n1_x = Math.trunc(n1.m_terminals[0][2][0] + 0.5);
					let n2_x = Math.trunc(n2.m_terminals[0][2][0] + 0.5);
					return -(n1_x - n2_x);
				}
				else {
					return n1_y - n2_y;
				}
			});
			let d_arr = []; // [x, y, label]
			for(let i = 0; i < this.m_netlist.length; ++i) {
				let term = this.m_netlist[i].m_terminals[1][2];
				let x = Math.trunc(term[0] + 0.5);
				let y = Math.trunc(term[1] + 0.5);
				d_arr.push([x, y, 0]);
			}
			d_arr.sort(function(d1, d2) {
				if(d1[1] == d2[1]) {
					return (d1[0] - d2[0]);
				}
				else {
					return d1[1] - d2[1];
				}
			});
			for(let i = 0; i < this.m_netlist.length; ++i) {
				let tx = Math.trunc(this.m_netlist[i].m_terminals[1][2][0] + 0.5);
				let ty = Math.trunc(this.m_netlist[i].m_terminals[1][2][1] + 0.5);
				let idx = d_arr.findIndex( i=> i[0] == tx && i[1] == ty);
				let l_max = 0;
				for(let j = 0; j < idx; ++j) {
					l_max = Math.max(l_max, d_arr[j][2]);
				}
				this.m_netlist[i].m_label = 1 + l_max;
				d_arr[idx][2] = Math.max(this.m_netlist[i].m_label, d_arr[idx][2]);
			}
			let k_max = 0;
			for(let i = 0; i < this.m_netlist.length; ++i) {
				k_max = Math.max(this.m_netlist[i].m_label, k_max);
			}
			let idx = this.m_netlist.findIndex(i => i.m_label == k_max);
			this.m_netlist[idx].m_set = 0;
			while(k_max > 1) {
				k_max -= 1;
				for(let i = 0; i < this.m_netlist.length; ++i) {
					if(this.m_netlist[i].m_label == k_max) {
						/*console.log(this.m_netlist[idx].m_terminals[0][2][0], this.m_netlist[idx].m_terminals[0][2][1]);
						console.log(this.m_netlist[idx].m_terminals[1][2][0], this.m_netlist[idx].m_terminals[1][2][1]);
						console.log(this.m_netlist[i].m_terminals[0][2][0], this.m_netlist[i].m_terminals[0][2][1]);
						console.log(this.m_netlist[i].m_terminals[1][2][0], this.m_netlist[i].m_terminals[1][2][1]);*/
						if(this.m_netlist[i].m_terminals[1][2][1] <= this.m_netlist[idx].m_terminals[1][2][1]) {
							this.m_netlist[i].m_set = 0;
							idx = i;
							break;
						}
					}
				}
			}
		}

		calculate_crossing() {
			for(let i = 0; i < this.m_netlist.length; ++i) {
				if(this.m_netlist[i].m_set == 1) {
					for(let j = 0; j < this.m_netlist.length; ++j) {
						if(this.m_netlist[i].m_terminals[0][2][1] < this.m_netlist[j].m_terminals[0][2][1]) {
							if(this.m_netlist[i].m_terminals[1][2][1] > this.m_netlist[j].m_terminals[1][2][1]) {
								this.m_netlist[i].m_cross += 1;
							}
						}
						else {
							if(this.m_netlist[i].m_terminals[1][2][1] < this.m_netlist[j].m_terminals[1][2][1]) {
								this.m_netlist[i].m_cross += 1;
							}
						}						
					}
				}				
			}
			
		}

		reset_label() {
			for(let i = 0; i < this.m_netlist.length; ++i) {
				this.m_netlist[i].m_label = 0;
				this.m_netlist[i].m_set = 1;
				this.m_cross = 0;
			}
		}


		//attempt to route board within time
		async route(timeout)
		{
			this.remove_netlist();
			this.unmark_distances();
			this.shuffle_netlist();
			

			// ffy-comment: order netlist
			this.maximum_noncrossing_matching();
			//this.calculate_crossing();
			this.net_ordering();
			//this.net_ordering_ori();
			// ffy comment: Set to store nets that cannot complete routing.
			let hoisted_nets = new Set();
			let index = 0;
	//		let start_time = std::chrono::high_resolution_clock::now();
			var t_start = Date.now();
			// ffy comment: net with small area will route first.
			while (index < this.m_netlist.length)
			{
				if (this.m_netlist[index].route()) index++;
				else
				{
					if (index === 0)
					{
						this.shuffle_netlist();
						this.reset_label();
						this.maximum_noncrossing_matching();
						//this.calculate_crossing();
						this.net_ordering();
						//this.net_ordering_ori();
						hoisted_nets.clear();
					}
					else
					{
						// ffy comment: Move netlist[index] to the front of all nets with same congest
						let pos = this.hoist_net_ori(index);
						// ffy comment: If netlist[index].congest is unique
						//or the second time cannot route this net without changing congest
						if ((pos === index) || (hoisted_nets.has(this.m_netlist[pos])))
						{
							// ffy comment: If pos is 0, the net has the highest priority
							if (pos !== 0)
							{
								// ffy comment: Decrease m_area of the net for higher routing priority
								this.m_netlist[pos].m_area = this.m_netlist[pos-1].m_area;
								// ffy comment: Move netlist[pos] to the top of all nets with same m_area 
								pos = this.hoist_net_ori(pos);
							}
							// ffy comment: Since m_area changed, remove from the Set
							hoisted_nets.delete(this.m_netlist[pos]); 
						}
						else hoisted_nets.add(this.m_netlist[pos]); // ffy comment: Put the net into the set
						// ffy comment: For all nets with lower priority, remove and route again afterwards
						// ffy comment: lower prioirty -> m_area is larger or same m_area but index is lager
						while (index > pos)
						{
							this.m_netlist[index].remove();
							this.m_netlist[index].shuffle_topology();
							index--;
						}
					}
				}
	//			let end_time = std::chrono::high_resolution_clock::now();
	//			std::chrono::duration<float> elapsed = end_time - start_time;
	//			if (elapsed.count() >= timeout) return false;
				if (this.m_verbosity >= 1) postMessage([this.output_pcb(), 0]);
			
			}
			var t_end = Date.now();
			console.log(t_end - t_start);
			return true;
		}

		//cost of board in complexity terms
		cost()
		{
			// ffy comment: only condiser wire length
			let sum = 0;
			for (let net of this.m_netlist) for (let path of net.m_paths) sum += path.length;
			return sum;
		}

		//increase area quantization
		increase_quantization()
		{
			this.m_quantization++;
		}

		//output netlist and paths of board for viewer app
		output_pcb()
		{
			let scale = 1.0 / this.m_resolution;
			let tracks = [];
			for (let net of this.m_netlist) tracks.push(net.output_net());
			return [[Math.trunc(this.m_width * scale), Math.trunc(this.m_height * scale), this.m_depth], tracks];
		}

		//convert grid node to space node
		grid_to_space_point(n)
		{
			let p = this.m_deform.get(n.toString());
			if (p !== undefined)
			{
				return p;
			}
			return n;
		}

		//set grid node to value
		// ffy comment: 3D array to 1D array, n[x][y][z]->m_node[z * width * height + y * width + x]
		set_node(n, value)
		{
			this.m_nodes[(this.m_stride*n[2])+(n[1]*this.m_width)+n[0]] = value;
			//console.log(n[0], n[1], n[2], value);
		}

		//get grid node value
		get_node(n)
		{
			return this.m_nodes[(this.m_stride*n[2])+(n[1]*this.m_width)+n[0]];
		}

		//generate all grid points surrounding node, that are not value 0
		all_marked(vec, n, s)
		{
			let w = this.m_width;
			let h = this.m_height;
			let d = this.m_depth;
			let gn = this.get_node;
			let sort_nodes = [];
			let x, y, z;
			[x, y, z] = n;
			for (let v of vec[(z + s) % 2])
			{
				let nx, ny, nz;
				[nx, ny, nz] = v;
				nx += x, ny += y, nz += z;
				if ((0 <= nx) && (nx < w)
				 	&& (0 <= ny) && (ny < h)
					&& (0 <= nz) && (nz < d))
				{
					let n = [nx, ny, nz];
					let mark = gn.call(this, n);
					if (mark !== 0) sort_nodes.push([mark, n]);
				}
			}
			return sort_nodes;
		}

		//generate all grid points surrounding node, that are value 0
		all_not_marked(vec, n)
		{
			let w = this.m_width;
			let h = this.m_height;
			let d = this.m_depth;
			//let gn = this.get_node;
			let nodes = [];
			let x, y, z;
			[x, y, z] = n;
			for(let i = 0; i < 1; ++i) {
			for (let v of vec[(z + i) % 2]) {
				let nx, ny, nz;
				[nx, ny, nz] = v;
				nx += x, ny += y, nz += z;
				if ((0 <= nx) && (nx < w)
				 	&& (0 <= ny) && (ny < h)
					&& (0 <= nz) && (nz < d))
				{
					let n = [nx, ny, nz];
					//if (gn.call(this, n) === 0) nodes.push(n);
					if (this.get_node(n) === 0) nodes.push(n);
				}
			}
			}
			return nodes;
		}

		//generate all grid points surrounding node sorted
		// ffy comment: add shift to generate diiferent layer routing vector
		all_nearer_sorted(vec, n, dfunc, shift)
		{
			let gsp = this.grid_to_space_point;
			let gp = gsp.call(this, n);
			let distance = this.get_node(n);
			// ffy comment: nm : [0] mark distance calculate in mark_distance(), [1] node info
			let marked_nodes = this.all_marked(vec, n, shift).filter((mn) =>
			{
				// ffy comment: Since we are finding path from end to start, the distance we choose must 
				// be smaller then the current distance.
				//console.log('seek', mn[1], mn[0]);
				if ((distance - mn[0]) <= 0) return false;
				// ffy comment: use the selected distance function to calculate distance between nearby points.
				mn[0] = dfunc(gsp.call(this, mn[1]), gp);
				return true;
			});
			marked_nodes.sort(function(s1, s2) { return s1[0] - s2[0]; });
	
			return marked_nodes.map(function(mn) { return mn[1]; });
			//return marked_nodes;
		}

		//generate all grid points surrounding node that are not shorting with an existing track
		all_not_shorting(gather, n, radius, gap)
		{
			let gsp = this.grid_to_space_point;
			let layers = this.m_layers;
			let hit_line = this.m_layers.hit_line;
			let nodes = [];
			let np = gsp.call(this, n);
			for (let new_node of gather)
			{
				let nnp = gsp.call(this, new_node);
				if (!hit_line.call(layers, np, nnp, radius, gap)) nodes.push(new_node);
			}
			return nodes;
		}

		//flood fill distances from starts till ends covered
		// ffy comment: Perform A* like algorithm to mark the distance form starts to ends 
		mark_distances(vec, radius, via, gap, starts, ends)
		{
			let gn = this.get_node; // ffy comment: Similar to function pointer of get_node(n);
			let sn = this.set_node; // ffy comment: Same as above
			let anm = this.all_not_marked;
			let ans = this.all_not_shorting;
			let via_vectors = this.m_via_vectors;
			let distance = 1;
			let frontier = new NodeSet(starts);
			let vias_nodes = new Map();
			while (frontier.size || vias_nodes.size)
			{
				for (let node of frontier) sn.call(this, node, distance); // ffy comment: Same as this.set_node(node, distance);
				if (ends.every((node) => { return gn.call(this, node); })) break; // ffy comment: Check if all end node are marked.
				let new_nodes = new NodeSet();
				for (let node of frontier)
				{
					for (let new_node of ans.call(this, anm.call(this, vec, node), node, radius, gap))
					{
						new_nodes.add(new_node);
					}
				}
				let new_vias_nodes = new NodeSet();
				for (let node of frontier)
				{
					for (let new_node of ans.call(this, anm.call(this, via_vectors, node), node, via, gap))
					{
						new_vias_nodes.add(new_node);
					}
				}
				// ffy comment: If via cost greater than 0, the distance value will be higher
				// although physical distance is the same.
				if (new_vias_nodes.size) vias_nodes.set(distance+this.m_viascost, new_vias_nodes);
				let delay_nodes = vias_nodes.get(distance);
				if (delay_nodes !== undefined)
				{
					for (let node of delay_nodes) if (gn.call(this, node) === 0) new_nodes.add(node);
					vias_nodes.delete(distance);
				}
				frontier = new_nodes;
				distance++;
			}
		}

		//set all grid values back to 0
		unmark_distances()
		{
			this.m_nodes.fill(0);
		}

		// ffy-comment: net ordering function
		net_ordering() {
			this.m_netlist.sort(function(n1, n2)
			{
				if(n1.m_set == n2.m_set) {
						if (n1.m_area === n2.m_area) {
							if(n1.m_cross == n2.m_cross) return n1.m_radius - n2.m_radius;
							return n1.m_corss - n2.m_cross;
						}
						return n1.m_area - n2.m_area;
				}
				else { 
					return n1.m_set - n2.m_set;
				}
			});
		}
		
		net_ordering_ori() {
			this.m_netlist.sort(function(n1, n2)
			{
				if (n1.m_area === n2.m_area) return n1.m_radius - n2.m_radius;
				return n1.m_area - n2.m_area;
			});
		}


		//shuffle order of netlist
		shuffle_netlist()
		{
			this.m_netlist.shuffle();
			for (let net of this.m_netlist) net.shuffle_topology();
		}

		hoist_net(n)
		{
			let i = 0;
			if (n != 0)
			{
				for (i = n; i >= 0; --i) if (this.m_netlist[i].m_area < this.m_netlist[n].m_area) break;
				i++;
				if (n != i)
				{
					this.m_netlist.move(n, i);
				}
			}
			return i;
		}

		hoist_net_ori(n)
		{
			let i = 0;
			if (n != 0)
			{
				for (i = n; i >= 0; --i) if (this.m_netlist[i].m_area < this.m_netlist[n].m_area) break;
				i++;
				if (n != i)
				{
					this.m_netlist.move(n, i);
				}
			}
			return i;
		}
	}

	//scale terminals for resolution of grid
	function scale_terminals(terms, res)
	{
		for (let term of terms)
		{
			term[0] *= res;
			term[1] *= res;
			term[2][0] *= res;
			term[2][1] *= res;
			for (let p of term[3])
			{
				p[0] *= res;
				p[1] *= res;
			}
		}
	}

	//net methods
	class Net
	{
		constructor(radius, via, gap, terms, pcb)
		{
			this.m_pcb = pcb;
			this.m_radius = radius * pcb.m_resolution;
			this.m_via = via * pcb.m_resolution;
			this.m_gap = gap * pcb.m_resolution;
			this.m_terminals = terms;
			this.m_paths = [];
			scale_terminals(this.m_terminals, pcb.m_resolution);
			// ffy-comment: m_bbox[4]: [minx, miny, maxx, maxy]			
			[this.m_area, this.m_bbox] = aabb_terminals(this.m_terminals, pcb.m_quantization);
			this.remove();
			for (let term of this.m_terminals)
			{
				for (let z = 0; z < pcb.m_depth; ++z)
				{
					let p = [Math.trunc(term[2][0] + 0.5),Math.trunc(term[2][1] + 0.5), z];
					let sp = [term[2][0], term[2][1], z];
					pcb.m_deform.set(p.toString(), sp);
				}
			}
			// ffy-comment: for net ordering
			this.x_diff = Math.abs(this.m_bbox[2] - this.m_bbox[0]);
			this.y_diff = Math.abs(this.m_bbox[3] - this.m_bbox[1]);
			this.m_set = 1;
			this.m_label = 0;
			this.m_cross = 0;
		}

		//randomize order of terminals
		// ffy comment: don't randomize order for now
		shuffle_topology()
		{
			//this.m_terminals.shuffle();
		}

		//add terminal entries to spacial cache
		add_terminal_collision_lines()
		{
			for (let node of this.m_terminals)
			{
				let r, g, x, y, shape;
				[r, g, [x, y, ,], shape] = node;
				if (!shape.length)
					this.m_pcb.m_layers.add_line([x, y, 0], [x, y, this.m_pcb.m_depth - 1], r, g);
				else
				{
					for (let z = 0; z < this.m_pcb.m_depth; ++z)
					{
						let p1 = [x + shape[0][0], y + shape[0][1], z];
						for (let i = 1; i < shape.length; ++i)
						{
							let p0 = p1;
							p1 = [x + shape[i][0], y + shape[i][1], z];
							this.m_pcb.m_layers.add_line(p0, p1, r, g);
						}
					}
				}
			}
		}

		//remove terminal entries from spacial cache
		sub_terminal_collision_lines()
		{
			for (let node of this.m_terminals)
			{
				let r, g, x, y, shape;
				[r, g, [x, y, ,], shape] = node;
				if (!shape.length)
					//this.m_pcb.m_layers.sub_line([x, y, 0], [x, y, this.m_pcb.m_depth - 1], r, g);
					this.m_pcb.m_layers.sub_line([x, y, 0], [x, y, 0], r, g);
				else
				{
					// ffy-comment: change z < this.m_pcg.m_depth to z < 1
					for (let z = 0; z < 1; ++z)
					{
						let p1 = [x + shape[0][0], y + shape[0][1], z];
						for (let i = 1; i < shape.length; ++i)
						{
							let p0 = p1;
							p1 = [x + shape[i][0], y + shape[i][1], z];
							this.m_pcb.m_layers.sub_line(p0, p1, r, g);
						}
					}
				}
			}
		}

		//add paths entries to spacial cache
		add_paths_collision_lines()
		{
			for (let path of this.m_paths)
			{
				let p1 = this.m_pcb.grid_to_space_point(path[0]);
				for (let i = 1; i < path.length; ++i)
				{
					let p0 = p1;
					p1 = this.m_pcb.grid_to_space_point(path[i]);
					if (path[i-1][2] !== path[i][2]) this.m_pcb.m_layers.add_line(p0, p1, this.m_via, this.m_gap);
					else this.m_pcb.m_layers.add_line(p0, p1, this.m_radius, this.m_gap);
				}
			}
		}

		//remove paths entries from spacial cache
		sub_paths_collision_lines()
		{
			for (let path of this.m_paths)
			{
				let p1 = this.m_pcb.grid_to_space_point(path[0]);
				for (let i = 1; i < path.length; ++i)
				{
					let p0 = p1;
					p1 = this.m_pcb.grid_to_space_point(path[i]);
					if (path[i-1][2] !== path[i][2]) this.m_pcb.m_layers.sub_line(p0, p1, this.m_via, this.m_gap);
					else this.m_pcb.m_layers.sub_line(p0, p1, this.m_radius, this.m_gap);
				}
			}
		}

		//remove net entries from spacial grid
		remove()
		{
			this.sub_paths_collision_lines();
			this.sub_terminal_collision_lines();
			this.m_paths = [];
			this.add_terminal_collision_lines();
		}

		//remove redundant points from paths
		optimise_paths(paths)
		{
			let opt_paths = [];
			for (let path of paths)
			{
				let opt_path = [];
				let d = [0.0, 0.0, 0.0];
				let p1 = this.m_pcb.grid_to_space_point(path[0]);
				for (let i = 1; i < path.length; ++i)
				{
					let p0 = p1;
					p1 = this.m_pcb.grid_to_space_point(path[i]);
					let d1 = js_pcb.norm_3d(js_pcb.sub_3d(p1, p0));
					if (!js_pcb.equal_3d(d1, d))
					{
						opt_path.push(path[i-1]);
						d = d1;
					}
				}
				opt_path.push(path[path.length-1]);
				opt_paths.push(opt_path);
			}
			return opt_paths;
		}

		//backtrack path from ends to starts
		backtrack_path(visited, end_node, radius, via, gap)
		{
			let via_vectors = this.m_pcb.m_via_vectors;
			let path = [];
			let path_node = end_node;
			let via_num = 0;
			for (;;)
			{
				path.push(path_node);
				//console.log('At', path_node, this.m_pcb.get_node(path_node));
				let nearer_nodes = [];
				let m_n = [];
				
				// Routing vector of this layer
				for (let node of this.m_pcb.all_not_shorting(
					this.m_pcb.all_nearer_sorted(this.m_pcb.m_routing_path_vectors, path_node, this.m_pcb.m_dfunc, 0),
					path_node, radius, gap))
				{
					nearer_nodes.push(node);
					//m_n.push(node);
				}
			
				// Routing vector of via
				for (let node of this.m_pcb.all_not_shorting(
					this.m_pcb.all_nearer_sorted(via_vectors, path_node, this.m_pcb.m_dfunc, 0),
					path_node, via, gap))
				{
					nearer_nodes.push(node);
					m_n.push(node);
				}

				//m_n.sort((a, b)=>{return a[0] - b[0]});
				//nearer_nodes = m_n.map(function(mn) { return mn[1]; });

				if (!nearer_nodes.length) return [[], false];
				let search = nearer_nodes.find(function(node) { return visited.has(node); });
				if (search !== undefined)
				{
					//found existing track
					path.push(search);
					//console.log(via_num, this.m_cross);
					via_num = 0;
					return [path, true];
				}
				// ffy comment: Set path_node to current node's nearest node, avoid using via
				path_node = nearer_nodes[0];
				if(nearer_nodes[0] === m_n[0]) {
					via_num += 1;
				}
			}
		}

		//attempt to route this net on the current boards state
		route()
		{
			//check for unused terminals track
			//if(this.m_set == 1) return true; 
			if (this.m_radius === 0.0) return true;
			this.m_paths = [];
			this.sub_terminal_collision_lines();
			let visited = new NodeSet();
			let i = 0;
			for (let index = 1; index < this.m_terminals.length; ++index)
			{
				let ends = [];
				// ffy comment: change z < this.m_pcb.m_depth to 1
				for (let z = 0; z < 1; ++z)
				{
					let x = Math.trunc(this.m_terminals[index][2][0]+0.5);
					let y = Math.trunc(this.m_terminals[index][2][1]+0.5);
					ends.push([x, y, z]);
				}
				// ffy comment: Check if the end point has been visited
				let search = ends.find(function(node) { return visited.has(node); });
				if (search !== undefined) {
					continue; //ffy comment: This end point has been visited already
				}
				// ffy comment: This end point has not been visited yet
				// ffy comment: change z < this.m_pcb.m_depth to z < 1
				for (let z = 0; z < 1; ++z)
				{
					let x = Math.trunc(this.m_terminals[index-1][2][0]+0.5);
					let y = Math.trunc(this.m_terminals[index-1][2][1]+0.5);
					visited.add([x, y, z]);
				}
				this.m_pcb.mark_distances(this.m_pcb.m_routing_flood_vectors, this.m_radius, this.m_via, this.m_gap,
					 						visited, ends);
				let sorted_ends = [];
				// ffy comment: push (distance from already visited nodes, end node) into sorted_ends
				for (let node of ends) sorted_ends.push([this.m_pcb.get_node(node), node]);
				sorted_ends.sort(function(s1, s2) { return s1[0] - s2[0]; });
				let result = this.backtrack_path(visited, sorted_ends[0][1], this.m_radius, this.m_via, this.m_gap);
				this.m_pcb.unmark_distances();
				if (!result[1])
				{
					this.remove();
					return false;
				}
				for (let node of result[0]) visited.add(node);
				this.m_paths.push(result[0]);
			}
			this.m_paths = this.optimise_paths(this.m_paths);
			this.add_paths_collision_lines();
			this.add_terminal_collision_lines();
			return true;
		}
		//output net, terminals and paths, for viewer app
		output_net()
		{
			let pcb = this.m_pcb;
			let gsp = this.m_pcb.grid_to_space_point;
			let scale = 1.0 / this.m_pcb.m_resolution;
			let track = [];
			track.push(this.m_radius*scale);
			track.push(this.m_via*scale);
			track.push(this.m_gap*scale);
			track.push(this.m_terminals.map(function(t)
			{
				return [t[0]*scale, t[1]*scale, [t[2][0]*scale, t[2][1]*scale, t[2][2]],
					t[3].map(function(n) { return [n[0]*scale, n[1]*scale]; })];
			}));
			track.push(this.m_paths.map(function(path)
			{
				return path.map(function(n)
				{
					let p = gsp.call(pcb, n);
					return [p[0]*scale, p[1]*scale, p[2]];
				});
			}));
			return track;
		}
	}

	js_pcb.Pcb = Pcb;
})();
