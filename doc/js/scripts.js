window.page = 0;
var PAGINATION = 5;

function showPosts(types, home) {
    let all_posts = [];
    for (let j = 0; j < types.length; j++){
        let type = types[j];
        $.ajax({
            async: false,
            type: 'GET',
            url: type + ".json",
            success: function(posts) {
                for (let i = 0; i < posts.length; i++) {
                    if (posts[i].type === type)
                        if(home === true){
                            // Show the post on the homepage
                            if(!posts[i].home) continue
                        }
                        all_posts.push(posts[i])
                }
            }
        });
    }

    all_posts.sort(function(post_a, post_b){
        date_a = new Date(post_a.month + " " + post_a.date + "," + post_a.year)
        date_b = new Date(post_b.month + " " + post_b.date + "," + post_b.year)
        return date_b - date_a;
    });

    let nextPage = Math.min(all_posts.length, window.page + PAGINATION) 

    for (let i = window.page; i < nextPage; i++) {
            // console.log(all_posts[i])
            $( "#btn_more").before(`
                <!-- Post preview-->
                <div class="post-preview">
                    <a href=` + all_posts[i].url + `>
                        <h2 class="post-title">` + all_posts[i].title + `</h2>
                        <h3 class="post-subtitle">` + all_posts[i].subtitle + `</h3>
                    </a>
                    <p class="post-meta">
                        Posted by
                        <a href="https://wuhanstudio.cc">` + all_posts[i].author + `</a>
                        on ` + all_posts[i].month + ' ' + all_posts[i].date + `, ` + all_posts[i].year + `
                    </p>
                </div>
                <!-- Divider-->
                <hr class="my-4" />
            `);
    }

    window.page = nextPage;

    if (nextPage === all_posts.length) {
        $('#btn_page').addClass("disabled");
    }
}
