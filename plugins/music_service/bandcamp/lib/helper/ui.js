'use strict';

const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');

class UIHelper {

    static getBandcampIcon() {
        return `<img src="/albumart?sourceicon=${encodeURIComponent('music_service/bandcamp/assets/images/bandcamp.svg')}" style="width: 23px; height: 23px; margin-right: 8px; margin-top: -3px;" />`;
    }
    static addBandcampIconToListTitle(s) {
        return `${this.getBandcampIcon()}${s}`;
    }

    static addIconBefore(faClass, s) {
        return `<i class="${faClass}" style="padding-right: 15px;"></i>${s}`;
    }

    static styleText(s, style) {
        return `<span${ style ? ' style=\'' + style + '\'' : ''}>${s}</span>`;
    }

    static wrapInDiv(s, style) {
        return `<div${ style ? ' style=\'' + style + '\'' : ''}>${s}</div>`;
    }

    static addTextBefore(s, textToAdd, style) {
        return this.styleText(textToAdd, style) + s;
    }

    static addNonPlayableText(s) {
        return this.addTextBefore(s, bandcamp.getI18n('BANDCAMP_NON_PLAYABLE'), this.STYLES.NON_PLAYABLE);
    }

    static getMoreText() {
        return this.styleText(bandcamp.getI18n('BANDCAMP_MORE'), this.STYLES.NEXT_PAGE);
    }

    static constructListTitleWithLink(title, links, isFirstList) {
        let html = `<div style="display: flex; width: 100%; align-items: flex-end;${isFirstList ? '' : ' margin-top: -24px;'}">
                    <div>${title}</div>
                    <div style="flex-grow: 1; text-align: right; font-size: small;">`;

        if (Array.isArray(links)) {
            links.forEach( (link, index) => {
                html += this._constructLinkItem(link);
                if (index < links.length - 1) {
                    html += '<span style="padding: 0px 5px;">|</span>';
                }
            })
        }
        else {
            html += this._constructLinkItem(links);
        }

        html += '</div></div>';

        return html;
    }

    static _constructLinkItem(link) {
        let html = '';
        if (link.icon) {
            if (link.icon.type === 'fa' && link.icon.float !== 'right') {
                html += `<i class="${link.icon.class}" style="position: relative; top: 1px; margin-right: 2px; font-size: 16px;${ link.icon.color ? ' color: ' + link.icon.color + ';': ''}"></i>`;
            }
            else if (link.icon.type === 'bandcamp') {
                html += `<img src="/albumart?sourceicon=${encodeURIComponent('music_service/bandcamp/assets/images/bandcamp.svg')}" style="width: 23px; height: 23px; margin-top: -3px;" />`;
            }
        }
        html += `<a${link.target ? ' target="' + link.target + '"' : ''} href="${link.url}"${link.onclick ? ' onclick="' + link.onclick + '"' : ''}>
                    ${link.text}
                </a>`;
        if (link.icon && link.icon.type === 'fa' && link.icon.float === 'right') {
            html += `<i class="${link.icon.class}" style="position: relative; top: 1px; margin-left: 2px; font-size: 16px;${ link.icon.color ? ' color: ' + link.icon.color + ';': ''}"></i>`;
        }

        return html;
    }

}

UIHelper.STYLES = {
    NON_PLAYABLE: 'color: #b38536; font-size: 10px; padding-right: 8px;',
    NEXT_PAGE: 'color: #7a848e;',
    LIST_ITEM_SELECTED: 'color: #54c688; font-weight: bold;',
    RESOURCE_TYPE: 'color: #999; font-size: 10px; padding-right: 8px;',
    ARTICLE_SECTION: {
        TEXT: 'color: #ddd; font-size: 16px; line-height: 24px; padding: 16px 0px 48px 0px; text-align: justify;',
        MEDIA_ITEM_NAME: 'font-size: 16px; font-weight: bold; font-style: italic;',
        MEDIA_ITEM_ARTIST: 'font-size: 16px; font-weight: bold;'
    }
}

module.exports = UIHelper;