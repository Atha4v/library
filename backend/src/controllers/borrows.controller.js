const borrowsService = require('../services/borrows.service')
const { ok } = require('../utils/response')

async function create(req, res) {
  const data = await borrowsService.borrowBook(req.user.id, req.body.bookId)
  return ok(res, data, 'Book borrowed successfully', 201)
}

async function listAll(req, res) {
  const data = await borrowsService.listAllLoans(req.query.status)
  return ok(res, data, 'All loans')
}

async function listMine(req, res) {
  const data = await borrowsService.listMyLoans(req.user.id)
  return ok(res, data, 'My loans')
}

async function listOverdue(_req, res) {
  const data = await borrowsService.listOverdue()
  return ok(res, data, 'Overdue loans')
}

async function getById(req, res) {
  const data = await borrowsService.getLoanById(req.params.id, req.user)
  return ok(res, data, 'Loan detail')
}

async function returnLoan(req, res) {
  const data = await borrowsService.returnLoan(req.params.id, req.user)
  return ok(res, data, 'Book returned successfully')
}

async function renew(req, res) {
  const data = await borrowsService.renewLoan(req.params.id, req.user)
  return ok(res, data, 'Loan renewed')
}

module.exports = {
  create,
  listAll,
  listMine,
  listOverdue,
  getById,
  returnLoan,
  renew,
}
