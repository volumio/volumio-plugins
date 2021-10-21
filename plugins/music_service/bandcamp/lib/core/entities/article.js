'use strict';

class Article {

    constructor(url, title, description, thumbnail, date, category, author, mediaItems, sections) {
        this.type = 'article';
        this.url = url;
        this.title = title;
        this.description = description;
        this.thumbnail = thumbnail;
        this.date = date;
        this.category = category;
        this.author = author;
        this.mediaItems = mediaItems;
        this.sections = sections;
    }

}

module.exports = Article;