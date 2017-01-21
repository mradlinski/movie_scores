const Promise = require('bluebird');
const axios = require('axios');
const cheerio = require('cheerio');
const _ = require('lodash');
const Levenshtein = require('levenshtein');
const fs = Promise.promisifyAll(require('fs'));

const MAX_WEEK = 282;
//const MAX_WEEK = 3;

const loadDataForWeek = (weekNum=1) => {
    return axios({
        method: 'get',
        url: `http://www.sfp.org.pl/box_office?b=${weekNum}`
    }).then((res) => {
        const data = res.data;

        const $ = cheerio.load(data);

        const movies = [];

        $('.main_box_office_24').each((i, movieRow) => {
            movieRow = $(movieRow);

            movieRow.find('.f_10b').remove();

            const movie = {
                position: parseInt(movieRow.find('.main_box_office_25').text().trim()),
                title: movieRow.find('.main_box_office_27b > a').text().trim(),
                viewers: parseInt(movieRow.find('.main_box_office_29').text().trim().replace(' ', ''))
            };

            if (Number.isNaN(movie.position)) {
                console.log(`No box office data found for week ${weekNum}`);
                return false;
            }

            movies.push(movie);
        });

        return movies.length > 0 ? movies : null;
    });
};

const loadAllWeekData = () => {
    const promises = {};
    for(var i = 1; i < MAX_WEEK; ++i) {
        promises[i] = loadDataForWeek(i);
    }

    return Promise.props(promises).then((movies) => _.pickBy(movies, _.identity));
};

const groupWeekDataByMovie = (weekData) => {
    var movies = {};
    let counter = 0;
    _.forEach(weekData, (week) => {
        week.forEach((movie) => {
            if (!movies[movie.title]) {
                movies[movie.title] = {
                    title: movie.title,
                    score: NaN,
                    viewers: 0
                };

                counter += 1;
            }

            movies[movie.title].viewers += movie.viewers;
        });
    });

    console.log(`Total movies found: ${counter}`);

    return movies;
};

const getFilmwebScoreForMovie = (title) => {
    const url = `http://www.filmweb.pl/search/film?q=${encodeURIComponent(title)}`;

    return axios({
        method: 'get',
        url
    }).then((response) => {
        const $ = cheerio.load(response.data);

        const firstResult = $('.sep-hr.resultsList').children().first();

        const resultTitle = firstResult.find('.hitDesc > div > h3 > a').text().trim() || '';

        if ((new Levenshtein(title.toLowerCase(), resultTitle.toLowerCase())).distance > 3) {
            console.log(`No FilmWeb score found for title ${title} (closest match ${resultTitle})`);
            return null;
        }

        let score = firstResult.find('.hitDesc > div > div.well.boxContainer.rateInfo > div:nth-child(1) > strong').text();

        score = parseInt(score.trim().substr(0, score.length - 3).replace(',', ''));

        return score;
    }).catch(() => getFilmwebScoreForMovie(title));
};

const calcAverageViewersPerRoundedScore = (movies) => {
    const score = [];
    const viewers = [];
    const samples = [];

    for(var i = 0; i <= 100; i += 5) {
        let filtered = _.filter(movies, (m) => {
            return m.score > (i - 3) && m.score < (i + 3); 
        });

        if (filtered.length < 20) {
            continue;
        }

        score.push(i);
        
        viewers.push(_.reduce(filtered, (acc, el) => acc + el.viewers, 0) / filtered.length);

        samples.push(filtered.length);
    }

    return [score, viewers, samples];
};

loadAllWeekData()
.then(groupWeekDataByMovie)
.then((movies) => {
    return Promise.all(_.map(movies, (m, title) => {
        return getFilmwebScoreForMovie(title).then((score) => {
            if (!score || Number.isNaN(score)) {
                return null;
            }

            m.score = score;
            return m;
        });
    })).then((data) => {
        return data.filter(_.identity);
    });
})
.then(calcAverageViewersPerRoundedScore)
.then((data) => fs.writeFileAsync('data.json', JSON.stringify(data, null, 4)));