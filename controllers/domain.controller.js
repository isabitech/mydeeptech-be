const mongoose = require('mongoose');
const domainService = require('../services/domain.service.js');

const create = async (req, res) => {
  const data = await domainService.createDomain(req.body);
  res.status(201).json({
    success: true,
    message: 'Domain created',
    error: null,
    data
  });
};

const update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Domain ID',
      error: 'CastError',
      data: null
    });
  }
  const data = await domainService.updateDomain(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Domain updated', error: null, data });
};

const remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Domain ID',
      error: 'CastError'
    });
  }
  await domainService.deleteDomain(req.params.id);
  res.status(200).json({ success: true, message: 'Domain deleted', error: null, data: null });
};

const fetchByParent = async (req, res) => {
  const { parentId, parentModel } = req.query;
  if (!mongoose.isValidObjectId(parentId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Parent ID',
      error: 'CastError'
    });
  }
  const data = await domainService.fetchByParent(parentId, parentModel);
  res.status(200).json({ success: true, message: 'Domain fetched', error: null, data });
};

const findAll = async (req, res) => {
  const data = await domainService.findAll();
  res.status(200).json({ success: true, message: 'Domains fetched', error: null, data });
};

module.exports = {
  create,
  update,
  remove,
  fetchByParent,
  findAll
};