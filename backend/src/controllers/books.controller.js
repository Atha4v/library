const booksService = require('../services/books.service')
const { ok } = require('../utils/response')

async function list(req, res) {
  const data = await booksService.listBooks(req.query)
  return ok(res, data)
}

async function getById(req, res) {
  const data = await booksService.getBookById(req.params.id)
  return ok(res, data, 'Book detail')
}

async function create(req, res) {
  const data = await booksService.createBook(req.body)
  return ok(res, data, 'Book created', 201)
}

async function update(req, res) {
  const data = await booksService.updateBook(req.params.id, req.body)
  return ok(res, data, 'Book updated')
}

async function updateQuantity(req, res) {
  const data = await booksService.updateQuantity(req.params.id, req.body)
  return ok(res, data, 'Quantity updated')
}

async function remove(req, res) {
  const data = await booksService.deleteBook(req.params.id)
  return ok(res, data, 'Book deleted')
}

module.exports = { list, getById, create, update, updateQuantity, remove }
