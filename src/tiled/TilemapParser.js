/* jshint maxlen:200 */
var utils = require('../utils');

var TilemapParser = {
    /**
     * Parse tilemap data from the cache and creates a Tilemap object.
     *
     * @method parse
     * @param {Phaser.Game} game - Game reference to the currently running game.
     * @param {string} key - The key of the tilemap in the Cache.
     * @param {number} [tileWidth=32] - The pixel width of a single map tile. If using CSV data you must
     *      specify this. Not required if using Tiled map data.
     * @param {number} [tileHeight=32] - The pixel height of a single map tile. If using CSV data you must
     *      specify this. Not required if using Tiled map data.
     * @param {number} [width=10] - The width of the map in tiles. If this map is created from Tiled or
     *      CSV data you don't need to specify this.
     * @param {number} [height=10] - The height of the map in tiles. If this map is created from Tiled or
     *      CSV data you don't need to specify this.
     * @return {object} The parsed map object.
     */
    parse: function (game, key, tileWidth, tileHeight, width, height) {
        if (typeof tileWidth === 'undefined') { tileWidth = 32; }
        if (typeof tileHeight === 'undefined') { tileHeight = 32; }
        if (typeof width === 'undefined') { width = 10; }
        if (typeof height === 'undefined') { height = 10; }

        if (typeof key === 'undefined') {
            return this.getEmptyData();
        }

        if (key === null) {
            return this.getEmptyData(tileWidth, tileHeight, width, height);
        }

        var map = game.cache.getTilemapData(key);

        if (map) {
            if (map.format === Phaser.Tilemap.CSV) {
                return this.parseCSV(key, map.data, tileWidth, tileHeight);
            }
            else if (map.format === Phaser.Tilemap.TILED_XML) {
                return this.parseTiledXML(map.data);
            }
            else if (!map.format || map.format === Phaser.Tilemap.TILED_JSON) {
                return this.parseTiledJSON(map.data);
            }
        }
        else {
            console.warn('Phaser.TilemapParser.parse - No map data found for key ' + key);
        }
    },

    parseCSV: Phaser.TilemapParser.parseCSV,

    getEmptyData: function () {
        var map = Phaser.TilemapParser.getEmptyData.apply(this, arguments);

        map.tilewidth = map.tileWidth;
        map.tileheight = map.tileHeight;
    },

    /**
     * Parses a Tiled JSON file into valid map data.
     *
     * @method parseTiledJSON
     * @param {object} data - The JSON map data.
     * @return {object} Generated and parsed map data.
     */
    parseTiledJSON: function (data) {
        if (data.orientation !== 'orthogonal') {
            console.warn('TilemapParser.parseTiledJSON: Only orthogonal map types are supported in this version of Phaser');
            return null;
        }

        data.format = Phaser.TILED_JSON;

        return data;
    },

    /**
     * Parses a Tiled JSON file into valid map data.
     *
     * @method parseTiledXML
     * @param {object} data - The JSON map data.
     * @return {object} Generated and parsed map data.
     */
    parseTiledXML: function (data) {
        var mapElement = data.getElementsByTagName('map')[0],
            map = {
                version: parseFloat(mapElement.attributes.getNamedItem('version').nodeValue, 10),
                width: parseInt(mapElement.attributes.getNamedItem('width').nodeValue, 10),
                height: parseInt(mapElement.attributes.getNamedItem('height').nodeValue, 10),
                tilewidth: parseInt(mapElement.attributes.getNamedItem('tilewidth').nodeValue, 10),
                tileheight: parseInt(mapElement.attributes.getNamedItem('tileheight').nodeValue, 10),
                orientation: mapElement.attributes.getNamedItem('orientation').nodeValue,
                format: Phaser.Tilemap.TILED_XML,
                properties: {},
                layers: [],
                tilesets: []
            },
            i = 0,
            il = 0;

        //add the properties
        var mapprops = mapElement.getElementsByTagName('properties');
        for(i = 0, il = mapprops.length; i < il; ++i) {
            if(mapprops[i].parentNode === mapElement) {
                mapprops = mapprops.getElementsByTagName('property');

                for(var mp = 0; mp < mapprops.length; ++mp) {
                    map.properties[mapprops[mp].attributes.getNamedItem('name').nodeValue] = mapprops[mp].attributes.getNamedItem('value').nodeValue;
                }

                break;
            }
        }

        //add the layers
        var layers = mapElement.childNodes;//getElementsByTagName('layer');

        for(i = 0, il = layers.length; i < il; ++i) {
            var node = layers[i];

            if(node.nodeName === 'layer') {
                var lyr = node,
                    layer = {
                        type: 'tilelayer',
                        name: lyr.attributes.getNamedItem('name').nodeValue,
                        width: parseInt(lyr.attributes.getNamedItem('width').nodeValue, 10) || map.width,
                        height: parseInt(lyr.attributes.getNamedItem('height').nodeValue, 10) || map.height,
                        visible: lyr.attributes.getNamedItem('visible') ? lyr.attributes.getNamedItem('visible').nodeValue === '1' : true,
                        opacity: lyr.attributes.getNamedItem('opacity') ? parseFloat(lyr.attributes.getNamedItem('opacity').nodeValue, 10) : 1,
                        encoding: 'base64',
                        compression: '',
                        rawData: '',
                        data: '',
                        x: 0,
                        y: 0
                    };

                //set encoding
                var dataElement = lyr.getElementsByTagName('data')[0];
                layer.encoding = dataElement.attributes.getNamedItem('encoding').nodeValue;

                //set data from the text node of the element
                layer.rawData = dataElement.firstChild.nodeValue.trim();

                //set compression
                if(dataElement.attributes.getNamedItem('compression')) {
                    layer.compression = dataElement.attributes.getNamedItem('compression').nodeValue;
                }

                var decomp = utils.decompressBase64Data(layer.rawData, layer.encoding, layer.compression);

                layer.data = new Uint32Array(decomp.buffer, 0, decomp.length / 4);

                map.layers.push(layer);
            } else if(node.nodeName === 'objectgroup') {
                var grp = node,
                    group = {
                        type: 'objectgroup',
                        draworder: 'topdown',
                        name: grp.attributes.getNamedItem('name').nodeValue,
                        width: 0,
                        height: 0,
                        objects: [],
                        visible: grp.attributes.getNamedItem('visible') ? grp.attributes.getNamedItem('visible').nodeValue === '0' : true,
                        opacity: grp.attributes.getNamedItem('opacity') ? parseFloat(grp.attributes.getNamedItem('opacity').nodeValue, 10) : 1,
                        x: 0,
                        y: 0
                    };

                var objects = grp.getElementsByTagName('object');
                for(var oj = 0; oj < objects.length; ++oj) {
                    var obj = objects[oj],
                        object = {
                            gid: obj.attributes.getNamedItem('gid') ? parseInt(obj.attributes.getNamedItem('gid').nodeValue, 10) : null,
                            name: obj.attributes.getNamedItem('name') ? obj.attributes.getNamedItem('name').nodeValue : '',
                            type: obj.attributes.getNamedItem('type') ? obj.attributes.getNamedItem('type').nodeValue : '',
                            width: obj.attributes.getNamedItem('width') ? parseFloat(obj.attributes.getNamedItem('width').nodeValue, 10) : 0,
                            height: obj.attributes.getNamedItem('height') ? parseFloat(obj.attributes.getNamedItem('height').nodeValue, 10) : 0,
                            rotation: obj.attributes.getNamedItem('rotation') ? parseFloat(obj.attributes.getNamedItem('rotation').nodeValue, 10) : 0,
                            visible: obj.attributes.getNamedItem('visible') ? obj.attributes.getNamedItem('visible').nodeValue === '1' : true,
                            x: parseFloat(obj.attributes.getNamedItem('x').nodeValue, 10),
                            y: parseFloat(obj.attributes.getNamedItem('y').nodeValue, 10),
                            properties: {}
                        };

                    if(object.gid === null) {
                        delete object.gid;
                    }

                    var props = obj.getElementsByTagName('properties');
                    if(props.length) {
                        props = props.getElementsByTagName('property');
                        for(var pr = 0; pr < props.length; ++pr) {
                            object.properties[props[pr].attributes.getNamedItem('name').nodeValue] = props[pr].attributes.getNamedItem('value').nodeValue;
                        }
                    }

                    group.objects.push(object);
                }

                map.layers.push(group);
            }
        }

        //add the tilesets
        var tilesets = mapElement.getElementsByTagName('tileset');

        for(i = 0, il = tilesets.length; i < il; ++i) {
            var tset = tilesets[i],
                tiles = tset.getElementsByTagName('tile'),
                tileset = {
                    name: tset.attributes.getNamedItem('name').nodeValue,
                    firstgid: parseInt(tset.attributes.getNamedItem('firstgid').nodeValue, 10),
                    tilewidth: parseInt(tset.attributes.getNamedItem('tilewidth').nodeValue, 10),
                    tileheight: parseInt(tset.attributes.getNamedItem('tileheight').nodeValue, 10),
                    margin: 0,
                    spacing: 0,
                    tileoffset: { x: 0, y: 0 },
                    terrains: [],
                    properties: {},
                    tileproperties: {},
                    tiles: {}
                };

            //add spacing / margin attributes if exist
            var spacing = tset.attributes.getNamedItem('spacing');
            if(spacing) {
                tileset.spacing = parseInt(spacing.nodeValue, 10);
            }

            var margin = tset.attributes.getNamedItem('margin');
            if(margin) {
                tileset.margin = parseInt(margin.nodeValue, 10);
            }

            //add .properties if element exists
            var tsetprops = tset.getElementsByTagName('properties');
            for(var tsp = 0; tsp < tsetprops.length; ++tsp) {
                if(tsetprops[tsp].parentNode === tset) {
                    tsetprops = tsetprops.getElementsByTagName('property');

                    if(tsetprops.length) {
                        for(var p = 0; p < tsetprops.length; ++p) {
                            var tsetprop = tsetprops[p];

                            tileset.properties[tsetprop.attributes.getNamedItem('name').nodeValue] = tsetprop.attributes.getNamedItem('value').nodeValue;
                        }
                    }

                    break;
                }
            }

            //add .tiles if multi-image set
            for(var t = 0; t < tiles.length; ++t) {
                var tile = tiles[t],
                    id = tile.attributes.getNamedItem('id').nodeValue,
                    img = tile.getElementsByTagName('image');

                tileset.tiles[id] = {};

                //add attributes into the object
                for(var ta = 0; ta < tile.attributes.length; ++ta) {
                    var tileatr = tile.attributes[ta];

                    if(tileatr.name === 'id') {
                        continue;
                    }

                    switch(tileatr.name) {
                        case 'terrain':
                            tileset.tiles[id].terrain = tileatr.value.sply(',');
                            break;

                        case 'probability':
                            tileset.tiles[id].probability = parseFloat(tileatr.value, 10);
                            break;
                    }
                }

                //check if it has an image child
                if(img.length) {
                    tileset.tiles[id] = tileset.tiles[id] || {};
                    tileset.tiles[id].image = img[0].attributes.getNamedItem('source').nodeValue;
                }

                //add all the tile properties
                var tileprops = tile.getElementsByTagName('properties');
                if(tileprops.length) {
                    tileset.tileproperties[id] = {};
                    tileprops = tileprops[0].getElementsByTagName('property');
                    for(var tp = 0; tp < tileprops.length; ++tp) {
                        var tileprop = tileprops[tp];
                        tileset.tileproperties[id][tileprop.attributes.getNamedItem('name').nodeValue] = tileprop.attributes.getNamedItem('value').nodeValue;
                    }
                }
            }

            //check for terraintypes and add those
            var terrains = tset.getElementsByTagName('terraintypes');
            if(terrains.length) {
                terrains = terrains[0].getElementsByTagName('terrain');
                for(var tr = 0; tr < terrains.length; ++tr) {
                    tileset.terrains.push({
                        name: terrains[tr].attributes.getNamedItem('name').nodeValue,
                        tile: parseInt(terrains[tr].attributes.getNamedItem('tile').nodeValue, 10)
                    });
                }
            }

            //check for tileoffset and add that
            var offset = tset.getElementsByTagName('tileoffset');
            if(offset.length) {
                tileset.tileoffset.x = parseInt(offset[0].attributes.getNamedItem('x').nodeValue, 10);
                tileset.tileoffset.y = parseInt(offset[0].attributes.getNamedItem('y').nodeValue, 10);
            }

            //add image, imagewidth, imageheight
            var image = tset.getElementsByTagName('image');
            if(image.length === 1 && image[0].parentNode === tset) {
                tileset.image = image[0].attributes.getNamedItem('source').nodeValue;
                tileset.imagewidth = parseInt(image[0].attributes.getNamedItem('width').nodeValue, 10);
                tileset.imageheight = parseInt(image[0].attributes.getNamedItem('height').nodeValue, 10);
            }

            map.tilesets.push(tileset);
        }

        return map;
    }
};

module.exports = TilemapParser;
