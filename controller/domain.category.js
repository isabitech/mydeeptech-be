const domainService = require('../services/domain.service.js');

const create = async (req, res) => {
  const data = await domainService.createDomain(req.body);
  res.status(201).json(data);
};

const update = async (req, res) => {
  const data = await domainService.updateDomain(req.params.id, req.body);
  res.json(data);
};

const remove = async (req, res) => {
  await domainService.deleteDomain(req.params.id);
  res.json({ message: 'Domain deleted' });
};

const fetchByParent = async (req, res) => {
  const { parentId, parentModel } = req.query;
  const data = await domainService.fetchByParent(parentId, parentModel);
  res.json(data);
};

module.exports = {
  create,
  update,
  remove,
  fetchByParent
};
