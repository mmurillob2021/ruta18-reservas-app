-- Ruta 18 Sistema de Reservas de Mesas
-- Datos de ejemplo. Ejecutar después de schema.sql.
-- Los platos y precios son de ejemplo: reemplazarlos con la carta real antes de grabar el video.
-- Las reservas de prueba se crean desde la aplicación, no por SQL.

insert into public.mesas (nombre, zona, capacidad) values
  ('Mesa 1', 'terraza', 2),
  ('Mesa 2', 'terraza', 4),
  ('Mesa 3', 'salon', 6),
  ('Mesa 4', 'salon', 4),
  ('Mesa 5', 'salon', 8),
  ('Mesa 6', 'terraza', 4);

-- Martes a domingo de 12:00 a 22:00 con reservas de 90 minutos. Lunes cerrado (RF-11).
insert into public.horarios (dia_semana, hora_inicio, hora_fin, duracion_slot, activo) values
  ('lunes',     '12:00', '22:00', 90, false),
  ('martes',    '12:00', '22:00', 90, true),
  ('miercoles', '12:00', '22:00', 90, true),
  ('jueves',    '12:00', '22:00', 90, true),
  ('viernes',   '12:00', '22:00', 90, true),
  ('sabado',    '12:00', '22:00', 90, true),
  ('domingo',   '12:00', '22:00', 90, true);

insert into public.platos (nombre, categoria, descripcion, precio) values
  ('Hamburguesa Ruta 18', 'hamburguesas', 'Carne de res 180 g, queso cheddar, tocineta y salsa de la casa.', 28000),
  ('Hamburguesa doble', 'hamburguesas', 'Doble carne, doble queso, cebolla caramelizada.', 34000),
  ('Hamburguesa BBQ', 'hamburguesas', 'Carne de res, aros de cebolla y salsa BBQ.', 30000),
  ('Roll California', 'sushi', 'Cangrejo, aguacate y pepino. 10 piezas.', 26000),
  ('Roll Philadelphia', 'sushi', 'Salmón, queso crema y aguacate. 10 piezas.', 29000),
  ('Roll Ruta 18', 'sushi', 'Langostino tempura, queso crema y salsa anguila. 10 piezas.', 32000),
  ('Churrasco', 'platos', '350 g con papa a la francesa y ensalada.', 42000),
  ('Pechuga gratinada', 'platos', 'Pechuga en salsa de champiñones con queso gratinado.', 33000),
  ('Costillas BBQ', 'platos', 'Costillas de cerdo en salsa BBQ con papa rústica.', 39000),
  ('Limonada de coco', 'bebidas', 'Vaso de 16 oz.', 12000),
  ('Jugo natural', 'bebidas', 'En agua o en leche.', 9000),
  ('Gaseosa', 'bebidas', 'Botella personal.', 5000);
