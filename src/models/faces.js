var conf = require('../config');
const Redis = require('ioredis');
const Sequelize = require('sequelize')




const facesRedisSchema = {
    '$.id' : {
        type: Sequelize.INTEGER,
        SORTABLE: true,
        AS: 'id'
    },
    '$.num' : {
        type: Sequelize.Text,
        SORTABLE: true,
        AS: 'num'
    },
    '$.id_city' : {
        type: Sequelize.Integer,
        SORTABLE: true,
        AS: 'id_city'
    },
    '$.id_size' : {
        type: Sequelize.Integer,
        SORTABLE: true,
        AS: 'id_size'
    },
    '$.id_network' : {
        type: Sequelize.Integer,
        AS: 'id_networkd'
    },
    '$.address_ukr' : {
        type: Sequelize.Text,
        AS: 'address_ukr'
    },
    '$.address_ru' : {
        type: Sequelize.Text,
        AS: 'address_ru'
    },
    '$.address_en' : {
        type: Sequelize.Text,
        AS: 'address_en'
    },
    '$.sides' : {
        type: Sequelize.Text,
        AS: 'sides'
    },
    '$.lon' : {
        type: Sequelize.NUMERIC,
        AS: 'lon'
    },
    '$.lat' : {
        type: Sequelize.NUMERIC,
        AS: 'lat'
    },
    '$.grp' : {
        type: Sequelize.NUMERIC,
        AS: 'grp'
    },
    '$.ots' : {
        type: Sequelize.NUMERIC,
        AS: 'ots'
    },
    '$.doors_no' : {
        type: Sequelize.Text,
        AS: 'doors_no'
    },
    '$.pos' : {
        type: Sequelize.Integer,
        AS: 'pos'
    },
    '$.angle' : {
        type: Sequelize.Integer,
        AS: 'angle'
    },
    '$.id_catab' : {
        type: Sequelize.Integer,
        AS: 'id_catab'
    },
    '$.rating' : {
        type: Sequelize.Integer,
        AS: 'rating'
    },
    '$.light' : {
        type: Sequelize.Text,
        AS: 'light'
    },
    '$.supplier_sidetype' : {
        type: Sequelize.Text,
        AS: 'supplier_sidetype'
    },
    '$.busy' : {
        type: Sequelize.Integer,
        AS: 'busy'
    },
    '$.streets' : {
        type: Sequelize.Text,
        AS: 'streets'
    },
    '$.price' : {
        type: Sequelize.NUMERIC,
        AS: 'price'
    },
    '$.id_supplier' : {
        type: Sequelize.Integer,
        AS: 'id_supplier'
    },
    '$.photo_url' : {
        type: Sequelize.Text,
        AS: 'photo_url'
    },
    '$.schema_url' : {
        type: Sequelize.Text,
        AS: 'schema_url'
    },
    '$.supplier_sn' : {
        type: Sequelize.Text,
        AS: 'supplier_sn'
    },
    '$.supplier_weight' : {
        type: Sequelize.Integer,
        AS: 'supplier_weight'
    },
    '$.citytype_weight' : {
        type: Sequelize.Integer,
        AS: 'citytype_weight'
    },
    '$.size_weight' : {
        type: Sequelize.Integer,
        AS: 'size_weight'
    },
    '$.supplier' : {
        type: Sequelize.Text,
        AS: 'supplier'
    },
    '$.city' : {
        type: Sequelize.Text,
        AS: 'city'
    },
    '$.size' : {
        type: Sequelize.Text,
        AS: 'size'
    },
    '$.hide_doors_data' : {
        type: Sequelize.Integer,
        AS: 'hide_doors_data'
    },
    '$.total_print_cost' : {
        type: Sequelize.NUMERIC,
        AS: 'total_print_cost'
    },
    '$.delivery_cost' : {
        type: Sequelize.NUMERIC,
        AS: 'delivery_cost'
    },
    '$.city_region_ukr' : {
        type: Sequelize.Text,
        AS: 'city_region_ukr'
    },
    '$.IdFotoMonitor' : {
        type: Sequelize.Integer,
        AS: 'IdFotoMonitor'
    },
    '$.PhotoMonitorOnly' : {
        type: Sequelize.Integer,
        AS: 'PhotoMonitorOnly'
    }
}

var IndexCreate = false

const start = async () => {
    try {
        const client = new Redis(conf.get('REDIS'));
        await client.ft.create('idx:facesData', facesRedisSchema, {
          ON: 'JSON',
          PREFIX: 'facesData:'
        });
        IndexCreate = true;
    } 
    catch (e) {
        if (e.message === 'Index already exists') {
            console.log('Index exists already, skipped creation.');
            IndexCreate = true;
        } else {
            // Something went wrong, perhaps RediSearch isn't installed...
            IndexCreate = false;
            console.error(e);
            process.exit(1);
        }
    }

}
const setData = async (json) => {
    const client = new Redis(conf.get('REDIS'));
    try {
        await Promise.all(
            json.map((face) => {
                client.json.set(`facesData:${face.id}`, '$', face);
                client.json.expire(`facesData:${face.id}`, 2 * 60 * 60);
            })
        );
        }
    finally {
        client.disconnect()
    }
}

function RedisFaces(){
    this.Start= async ()=>{
       console.warn('------------------')
        // await start()
    }
    this.SetData= async (json)=>{
        if (!IndexCreate) await start();
        console.warn('IndexCreate',IndexCreate);
        console.warn('json',json);

        await setData(json);
    }    
    this.GetData= async (json)=>{
        // await 
    }
    // this.getData = function () {
    //   return faceOccupancy;
    // }
    // this.getFacesById = function () {
    //   return facesById;
    // }
    // this.startSync = function () {
    //   IdTimer = setTimeout(refreshTimer, 0);
    // }
}
  
module.exports = new RedisFaces();