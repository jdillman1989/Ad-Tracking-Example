import "whatwg-fetch";
import "./style.scss";
const fusion = window.Fusion;
const tracking = fusion.init();

(() => {

  // API config for advertising platform
  const platformParams = `query EditorialLinksQuery($count:Int $degree:String $editorial:Boolean $offset:Int $publisher:String!$subject:String $trafficSource:String $url:URL $widget:String){editorialLinks(count:$count degree:$degree editorial:$editorial offset:$offset publisher:$publisher subject:$subject trafficSource:$trafficSource url:$url widget:$widget){school{city id name provider{id platformLinkoutURL attributionScript} slug snippet state{abbreviation}} editorialLinks{id isLinkout isDsa program{id name publisherSnippet(publisherSlug:$publisher) snippet} url cap{id}}}}`;
  const platformVars = `{"publisher":"${privateSite}","count":3,"degree":"masters","subject":"nursing"}`;
  const platformEndpoint = `${privateAPI}/api?query=${encodeURI(platformParams)}&variables=${encodeURI(platformVars)}`;

  // WebContext session tracking
  const _ref3 = window._Cohesion || {};
  const tenantId = _ref3.tenantId;
  const webContext = _ref3.webContext;

  const webContextData = encodeURI(
    JSON.stringify({
      tenantId: tenantId,
      webContext: webContext,
    })
  );

  let productsData = [];

  // Create a unique ID per ad click
  const generateUUID = (n) =>
    n
      ? (n ^ ((16 * Math.random()) >> (n / 4))).toString(16)
      : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, generateUUID);

  // Functions to handle tracking data on click/viewed ads
  const addToProductsData = (payload) => productsData.push(payload);

  const getProductData = (programId) =>
    productsData.find(({ product }) => product.productId === programId);

  const genProductPayload = (
    prodIndex,
    programId,
    listingId,
    schoolName,
    viewCorrelationId
  ) => ({
    product: {
      formatSubtype: "optimized-ad",
      formatType: "ad",
      position: Number(prodIndex),
      variant: "masters",
      category: "nursing",
      productId: `${programId}`,
      sku: `${listingId}`,
      brand: schoolName,
    },
    viewCorrelationId: viewCorrelationId,
  });

  // Output the ad markup, including tracking data in the URL
  // Fire a tracking event for the product loading
  const buildListItem = (data, index) => {
    const { school, editorialLinks } = data;
    const listing = editorialLinks[0];

    const newUrl = `${listing.url}?trackingContext=${webContextData}`;
    const productIndex = index + 1;

    const viewCorrelationId = generateUUID();

    const productPayload = genProductPayload(
      productIndex,
      listing.program.id,
      listing.id,
      school.name,
      viewCorrelationId
    );

    addToProductsData(productPayload);
    tracking.productLoaded(productPayload);

    return `
      <a href="${newUrl}" rel="nofollow noopener" target="_blank" class="custom-el" data-product="${listing.program.id}">
        <div class="custom-el__title">
          <h3>${school.name}</h3>
          <p><strong>Program:</strong> ${listing.program.name}</p>
        </div>
        <div class="custom-el__logo">
          <img src="${privateServer}/${school.slug}.png?w=400&h=160" alt="${school.name}">
        </div>
        <div class="custom-el__description">
          <p>${listing.program.snippet}</p>
        </div>
        <div class="custom-el__button">
          <button>View Program</button>
        </div>
      </a>
    `;
  };

  // Fire a tracking event whenever an ad is scrolled into the viewport
  const observeWidget = (customELs) => {
    if ("IntersectionObserver" in window) {
      const targets = customELs.querySelectorAll(".custom-el");

      const handleViewObserver = (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const dataElement = entry.target;
            tracking.productViewed(getProductData(dataElement.dataset.product));
            observer.unobserve(entry.target);
          }
        });
      };

      const options = {
        threshold: 0.3,
      };

      const viewObserver = new IntersectionObserver(
        handleViewObserver,
        options
      );

      targets.forEach(target => {
        viewObserver.observe(target);
      });
    }
  };

  // Call ad platform API
  // Inject response into page widgets
  const fetchAds = () => 
    fetch(platformEndpoint)
      .then((resp) => resp.json())
      .then((data) => {
        if (data.data.editorialLinks) {
          return data.data.editorialLinks.map(buildListItem).join("");
        } else {
          return "";
        }
      })
      .then((elsHTML) => {
        if (elsHTML.length === 0) {
          console.error("Unable to gather editorial links from endpoint.");
          return;
        }

        const controlEL = document.querySelector(
          '[data-widget="editorial-links"]'
        );

        if (controlEL) {    
          const controlELs = document.querySelectorAll(
            '[data-widget="editorial-links"]'
          );

          controlELs.forEach(el => {
            if (el.tagName == "DIV") {
              const customELs = document.createElement("div");
              customELs.classList.add("custom-els-container");
              observeWidget(customELs);
            }
          });
        }
      })
      .catch((err) => console.error("Error fetching editorial links: " + err));

  // Once ads are on page, track clicks
  fetchAds().then(() => {
    document.addEventListener("click", (event) => {
      const { target } = event;

      if (target.classList.contains("custom-el")) {
        tracking.productClicked(getProductData(target.dataset.product));
      }
    });
  });
})();