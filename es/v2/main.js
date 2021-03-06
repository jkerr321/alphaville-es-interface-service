const moment = require('moment-timezone');
const nEsClient = require('@financial-times/n-es-client');
const images = require('./lib/images');
const summaries = require('./lib/summaries');
const authors = require('./lib/authors');
const primaryTheme = require('./lib/primaryTheme');
const bodyHTML = require('./lib/bodyHTML');
const embed = require('./lib/embed');
const webUrl = require('./lib/webUrl');
const title = require('./lib/title');

const avSeries = require('./lib/series');
const categorization = require('./lib/categorization');

function processArticles(response) {
	const transformPromises = [];

	response.forEach((article) => {
		transformPromises.push(Promise.all([
			categorization.processArticle(article),
			avSeries.processArticle(article, {resultSize:20}),
			webUrl.processArticle(article),
			bodyHTML.processArticle(article)
				.then(images.processArticle)
				.then(summaries.processArticle),
			authors.processArticle(article),
			primaryTheme.processArticle(article),
			title.processArticle(article)
		]));
	});

	return Promise.all(transformPromises).then(() => {
		return response;
	});
}

const defaultQuery = {
	"constant_score": {
		"filter": {
			"bool": {
				"must": [
					{
						"term": {
							"annotations.id": "89d15f70-640d-11e4-9803-0800200c9a66"
						}
					}
				],
				"should": [
					{
						"term": {
							"type": "article"
						}
					},
					{
						"term": {
							"type": "video"
						}
					}
				]
			}
		}
	}
};

function getAlphavilleEsQuery (query) {
	query = query || {};

	if (query.query) {
		query.query = {
			bool: {
				must: [
					defaultQuery,
					query.query
				]
			}
		};
	} else {
		query.query = defaultQuery;
	}

	return query;
}

module.exports = {
	searchArticles: function(query) {
		let total = 0;
		return nEsClient.search(getAlphavilleEsQuery(query))
			.then(articles => {
				total = articles.total;
				return articles;
			})
			.then(processArticles)
			.then(articleList => {
				return {
					items: articleList || [],
					total: articleList ? total || 0 : 0
				};
			});
	},
	getArticleByUuid: function (uuid) {
		return nEsClient.get(uuid)
			.then(article => {
				if (article) {

					return Promise.all([
						categorization.processArticle(article),
						avSeries.processArticle(article, {resultOrder:'asc'}),
						webUrl.processArticle(article),
						bodyHTML.processArticle(article)
							.then(images.processArticle)
							.then(embed.processArticle)
							.then(summaries.processArticle),
						authors.processArticle(article),
						primaryTheme.processArticle(article),
						title.processArticle(article)
					]).then(() => article);
				} else {
					return article;
				}
			});
	},
	getArticleByUrl: function (url) {
		return nEsClient.search(getAlphavilleEsQuery({
					query: {
						wildcard: {
							webUrl: url.replace(/[^\x00-\x7F]/g, (a) => encodeURI(a).toLowerCase())
						}
					},
					size: 1,
					sort: ['_score']
				})
			)
			.then(res => {
				if (!res.length) {
					return null;
				}

				return res[0];
			})
			.then(article => {
				if (article) {
					return Promise.all([
						categorization.processArticle(article),
						avSeries.processArticle(article, {resultOrder:'desc'}),
						webUrl.processArticle(article),
						bodyHTML.processArticle(article)
							.then(images.processArticle)
							.then(embed.processArticle)
							.then(summaries.processArticle),
						authors.processArticle(article),
						primaryTheme.processArticle(article),
						title.processArticle(article)
					]).then(() => article);
				} else {
					return article;
				}
			});
	}
};
