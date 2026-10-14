/**
 * validate({ body, query, params }) parses each part with its Zod schema and
 * exposes the cleaned values on req.validated. Controllers must read from
 * req.validated, never from raw req.body/query (unknown fields are stripped,
 * types are coerced, and NoSQL operator objects are rejected by the schemas).
 */
module.exports = (schemas) => (req, res, next) => {
  try {
    req.validated = {};
    ['params', 'query', 'body'].forEach((key) => {
      if (schemas[key]) req.validated[key] = schemas[key].parse(req[key]);
    });
    next();
  } catch (err) {
    next(err);
  }
};
