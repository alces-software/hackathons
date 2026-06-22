module.exports = (row) => {
   const out = {};

   for (const key in row) {
      const val = row[key];

      if (typeof val === 'bigint') {
         out[key] = val.toString();
      } else {
         out[key] = val;
      }
   }

   return out;
};
