const {Side, Face, Construction, City, DoorsShowing, Street, StreetAlias, ConstructionStreet} = require('../models')
/*
  select f.id_face id,
  f.num,
  cn.id_city,
  cn.id_sizetype id_size,
  fn.id_network,
  --dbo.func_map_getFaceStreet(f.id_face,'ukr') address_ukr,
  --dbo.func_map_getFaceStreet(f.id_face,'ru') address_ru,
  --dbo.func_map_getFaceStreet(f.id_face,'en') address_en,
  --dbo.func_web_face_occupancy(f.id_face) occupancy,
  STR(cn.lng,11,8) lon,
  STR(cn.lat,11,8) lat,
  cast(round(f.grp,2) as varchar) grp, f.ots, f.doors_no, f.pos, f.angle, f.id_cat id_catab, f.rating,
(case
    when (not exists (select
        fs.id_freeside
    from
        freesides fs
        inner join sides_face sf on fs.id_side=sf.id_side
        where sf.id_face = f.id_face and fs.date_beg<=dbo.func_web_EndDate()
        and (fs.date_end is null or fs.date_end>=dbo.func_web_StartDate())
    )) then 1 else 0 end) busy
    from constructions cn
        inner join v_web_faces f on f.id_constr=cn.id_constr
    inner join v_facesnetwork fn on f.id_face=fn.id_face

    */

/* v_web_faces
  SELECT
    f.id_face
      ,f.[id_constr]
      ,f.[num]
      ,s.[id_sidetype]
      ,s.id_cathegory [id_cat]
      ,s.[fromcenter]
      ,cn.[lat]
      ,cn.[lng]
      ,som.[angle]
      ,(case som.[pos] when 'left' then -1 when 'right' then 1 else 0 end) pos
      ,doors.[grp]
      ,doors.[ots]
      ,doors.[doors_no]
      ,(case s.mgr_rating when 'Рейтинговая' then 5 when 'Зона I' then 4 when 'Зона II' then 3 when 'Зона III' then 2 else 5 end) rating
  from constructions cn
    inner join orgs o on o.id_org=cn.id_org and o.devopers=1 and o.name<>'Бомонд'
    inner join cities c on cn.id_city=c.id_city
    inner join faces f on f.id_constr=cn.id_constr
    cross apply (select top 1 s.id_side from sides_face sf inner join sides s on sf.id_side=s.id_side where f.id_face=sf.id_face and (s.date_demounted is null or s.date_demounted>dbo.func_web_StartDate()) order by s.side_number asc) sf
    inner join sides s on sf.id_side=s.id_side
    inner join sides_on_map som on som.id_side=s.id_side
    inner join doors_showing doors on doors.doors_no=s.doors_no
  where (c.disabled is null or c.disabled=0)
*/

/*
  select ms.id, ms.name_ru,
    mlcs.addit_ru, ms.name_ua,
    mlcs.addit_ua, ms.name_en,
    mlcs.addit_en,
  s.addit_address side_addit_ru, s.addit_address_ukr side_addit_ua, s.addit_address_en side_addit_en
  from map_link_constr_street mlcs
  inner join map_street ms on mlcs.id_street=ms.id
  inner join sides s on mlcs.id_constr=s.id_constr
  where s.id_side=@id_side and mlcs.visible=1
  order by mlcs.weight asc
*/

const list = () => Face.findAll({
  attributes: ['id', 'num', ],
  required: true,
  include: [{
    model: Construction,
    attributes: ['cityId', 'lat', 'lon'],
    required: true,
    include: [{
      model: City,
      required: true,
      where: {
        disabled: null
      },
      attributes: []
    }/*, {

      model: ConstructionStreet,
      attributes: ['streetId', 'additUA', 'additRU', 'additEN', 'weight', 'visible']
      through: {
        attributes: ['additUA', 'additRU', 'additEN', 'weight', 'visible']
      }
    } */]
  }, {
    model: Side,
    as: 'firstSide',
    required: true,
    attributes: ['typeId', 'categoryId', 'fromCenter', 'mgrRating', 'doorsNo'],
    where: {
      demountedAt: {
        $or: {
          $eq: null,
          $gt: new Date()
        }
      }
    },
    include: [{
      model: DoorsShowing,
      as: 'doors',
      attributes: ['grp', 'ots']
    }]
  }]
})

module.exports = {
  list
}
